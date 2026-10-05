import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Activity, CheckCircle2, Loader2, Plus, RefreshCw, Save, Settings2, ShieldCheck, Users, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { TradingShell, PageHeading, SectionHeading } from '@/components/trading-shell';
import { requireAdminPage } from '@/lib/route-auth';

export const Route = createFileRoute('/admin')({ head: () => ({ meta: [
  {title:'系統管理 | JoshQuantTrader Pro'}, {name:'description',content:'系統狀態、交易參數與用戶管理。'},
  {property:'og:title',content:'系統管理 | JoshQuantTrader Pro'}, {property:'og:type',content:'website'}, {name:'twitter:card',content:'summary'},
] }), beforeLoad: requireAdminPage, component: AdminPage });

type Health = { ok: boolean; checks: Record<string, { ok: boolean; detail: string }> };
type ConfigResp = {
  config: Record<string, number>;
  meta: Record<string, { label: string; hint: string; min: number; max: number; step: number }>;
};
type AppUser = { id: string; username: string; role: string; active: boolean; created_at: string };

const CHECK_LABEL: Record<string, string> = { supabase: 'Supabase 資料庫', alpaca: 'Alpaca 券商', telegram: 'Telegram 通知', yahoo: 'Yahoo 行情源' };

function AdminPage() {
  const [tab, setTab] = useState<'health' | 'config' | 'users'>('health');
  const [health, setHealth] = useState<Health | null>(null);
  const [cfg, setCfg] = useState<ConfigResp | null>(null);
  const [draft, setDraft] = useState<Record<string, number>>({});
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newU, setNewU] = useState({ username: '', password: '', role: 'viewer' });
  const [delId, setDelId] = useState<string | null>(null);
  const [resetId, setResetId] = useState<string | null>(null);
  const [resetPw, setResetPw] = useState('');

  async function loadHealth() {
    try { setHealth(await (await fetch('/api/admin/health')).json()); } catch { /* */ }
  }
  async function loadConfig() {
    try {
      const d = await (await fetch('/api/admin/config')).json() as ConfigResp;
      setCfg(d); setDraft({ ...d.config });
    } catch { /* */ }
  }
  async function loadUsers() {
    try {
      const d = await (await fetch('/api/admin/users')).json() as { ok?: boolean; users?: AppUser[] };
      if (d.ok) setUsers(d.users ?? []);
    } catch { /* */ }
  }
  useEffect(() => { setLoading(true); Promise.all([loadHealth(), loadConfig(), loadUsers()]).finally(() => setLoading(false)); }, []);

  async function saveConfig() {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft) });
      const d = await res.json() as { ok?: boolean; error?: string; updated?: number };
      if (!res.ok || !d.ok) throw new Error(d.error || '儲存失敗');
      toast.success(`已更新 ${d.updated} 項參數，下次執行自動生效`);
      void loadConfig();
    } catch (e) { toast.error('儲存失敗', { description: e instanceof Error ? e.message : '' }); }
    finally { setSaving(false); }
  }

  async function addUser() {
    try {
      const res = await fetch('/api/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newU) });
      const d = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !d.ok) throw new Error(d.error || '新增失敗');
      toast.success(`已新增帳號 ${newU.username}`);
      setNewU({ username: '', password: '', role: 'viewer' });
      void loadUsers();
    } catch (e) { toast.error('新增失敗', { description: e instanceof Error ? e.message : '' }); }
  }

  async function toggleActive(u: AppUser) {
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: !u.active }) });
      const d = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !d.ok) throw new Error(d.error || '更新失敗');
      toast.success(`${u.username} 已${u.active ? '停用' : '啟用'}`);
      void loadUsers();
    } catch (e) { toast.error('更新失敗', { description: e instanceof Error ? e.message : '' }); }
  }

  async function doResetPw() {
    if (!resetId || resetPw.length < 8) { toast.error('密碼至少 8 個字元'); return; }
    try {
      const res = await fetch(`/api/admin/users/${resetId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: resetPw }) });
      const d = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !d.ok) throw new Error(d.error || '重設失敗');
      toast.success('密碼已重設');
      setResetId(null); setResetPw('');
      void loadUsers();
    } catch (e) { toast.error('重設失敗', { description: e instanceof Error ? e.message : '' }); }
  }

  async function doDelete() {
    if (!delId) return;
    try {
      const res = await fetch(`/api/admin/users/${delId}`, { method: 'DELETE' });
      const d = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !d.ok) throw new Error(d.error || '刪除失敗');
      toast.success('已刪除帳號');
      setDelId(null);
      void loadUsers();
    } catch (e) { toast.error('刪除失敗', { description: e instanceof Error ? e.message : '' }); }
  }

  const tabs = [
    { id: 'health' as const, label: '系統狀態', icon: Activity },
    { id: 'config' as const, label: '交易參數', icon: Settings2 },
    { id: 'users' as const, label: '用戶管理', icon: Users },
  ];

  return <TradingShell live><PageHeading eyebrow="ADMINISTRATION" title="系統管理" description="連線狀態監控、交易參數調整（即時生效）、登入帳號管理。" action={<div className="flex gap-2">
    {tabs.map(({id,label,icon:Icon}) => <Button key={id} type="button" variant={tab === id ? 'default' : 'outline'} onClick={() => setTab(id)} className="h-9 rounded-sm px-4 text-xs font-semibold"><Icon size={15}/>{label}</Button>)}
  </div>}/>

    {tab === 'health' && <section className="overflow-hidden rounded-sm border border-border bg-card">
      <SectionHeading title="連線狀態" subtitle="各外部服務即時檢查" action={<Button type="button" size="sm" variant="outline" onClick={() => { void loadHealth(); }} className="h-8 rounded-sm px-3 text-[11px]"><RefreshCw size={13}/>重新檢查</Button>}/>
      {loading && !health ? <p className="px-6 py-8 text-center text-sm text-subtle">檢查中…</p> :
      <div className="divide-y divide-border">{Object.entries(health?.checks ?? {}).map(([k, c]) => <div key={k} className="flex items-center gap-3 px-6 py-4">
        {c.ok ? <CheckCircle2 size={17} className="shrink-0 text-positive"/> : <XCircle size={17} className="shrink-0 text-negative"/>}
        <div><p className="text-sm font-semibold text-foreground">{CHECK_LABEL[k] ?? k}</p><p className="mt-0.5 text-[11px] text-subtle">{c.detail}</p></div>
        <span className={`ml-auto rounded-sm border px-2 py-1 text-[11px] font-semibold ${c.ok ? 'border-positive/40 bg-positive/15 text-positive' : 'border-negative/40 bg-negative/15 text-negative'}`}>{c.ok ? '正常' : '異常'}</span>
      </div>)}</div>}
      <div className="border-t border-border px-6 py-4 text-[11px] text-subtle">Telegram 只檢查設定（不發測試訊息）；測試發送請用 Dashboard 的「測試 Telegram」按鈕。</div>
    </section>}

    {tab === 'config' && <section className="overflow-hidden rounded-sm border border-border bg-card">
      <SectionHeading title="交易參數" subtitle="修改後下次執行自動生效，不需重部署" action={<Button type="button" size="sm" onClick={saveConfig} disabled={saving} className="h-8 rounded-sm px-3 text-[11px] font-semibold">{saving ? <Loader2 size={13} className="animate-spin"/> : <Save size={13}/>}{saving ? '儲存中…' : '儲存參數'}</Button>}/>
      {!cfg ? <p className="px-6 py-8 text-center text-sm text-subtle">載入中…</p> :
      <div className="grid gap-px bg-border sm:grid-cols-2">{Object.entries(cfg.meta).map(([k, m]) => <div key={k} className="bg-card px-6 py-4">
        <label className="text-xs font-semibold text-foreground">{m.label}</label>
        <p className="mt-0.5 text-[11px] text-subtle">{m.hint}</p>
        <div className="mt-2 flex items-center gap-2">
          <input type="number" min={m.min} max={m.max} step={m.step} value={draft[k] ?? ''}
            onChange={(e) => setDraft({ ...draft, [k]: Number(e.target.value) })}
            className="h-9 w-32 rounded-sm border border-border bg-secondary px-3 text-sm tabular-nums text-foreground outline-none"/>
          <span className="text-[11px] text-subtle">範圍 {m.min}～{m.max}</span>
        </div>
      </div>)}</div>}
    </section>}

    {tab === 'users' && <>
      <section className="overflow-hidden rounded-sm border border-border bg-card">
        <SectionHeading title="帳號列表" subtitle={`${users.length} 個帳號`}/>
        <div className="overflow-x-auto"><table className="data-table w-full min-w-[640px] text-left"><thead><tr><th>帳號</th><th>角色</th><th>狀態</th><th>建立時間</th><th className="text-right">操作</th></tr></thead>
        <tbody>{users.map((u) => <tr key={u.id}>
          <td className="font-semibold text-foreground">{u.username}</td>
          <td><span className={`inline-flex rounded-sm border px-2 py-1 text-[11px] font-semibold ${u.role === 'admin' ? 'border-primary/40 bg-primary/15 text-primary' : 'border-border bg-secondary text-muted-foreground'}`}>{u.role === 'admin' ? '管理員' : '查看者'}</span></td>
          <td><span className={`inline-flex items-center gap-1.5 text-xs ${u.active ? 'text-positive' : 'text-subtle'}`}><span className={`size-1.5 rounded-full ${u.active ? 'bg-positive' : 'bg-subtle'}`}/>{u.active ? '啟用' : '停用'}</span></td>
          <td className="text-xs tabular-nums text-muted-foreground">{new Date(u.created_at).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
          <td className="text-right"><div className="flex justify-end gap-1.5">
            <Button type="button" size="sm" variant="outline" onClick={() => toggleActive(u)} className="h-7 rounded-sm px-2 text-[11px]">{u.active ? '停用' : '啟用'}</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setResetId(u.id)} className="h-7 rounded-sm px-2 text-[11px]">重設密碼</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setDelId(u.id)} className="h-7 rounded-sm px-2 text-[11px] text-negative hover:text-negative">刪除</Button>
          </div></td>
        </tr>)}</tbody></table></div>
      </section>
      <section className="mt-6 overflow-hidden rounded-sm border border-border bg-card">
        <SectionHeading title="新增帳號" subtitle="查看者只能看頁面，不能進系統管理"/>
        <div className="flex flex-wrap items-end gap-3 px-6 py-5">
          <div><label className="text-[11px] text-muted-foreground">帳號</label><input value={newU.username} onChange={(e) => setNewU({ ...newU, username: e.target.value })} className="mt-1.5 block h-9 w-44 rounded-sm border border-border bg-secondary px-3 text-sm text-foreground outline-none" placeholder="username"/></div>
          <div><label className="text-[11px] text-muted-foreground">密碼（至少8字元）</label><input type="password" value={newU.password} onChange={(e) => setNewU({ ...newU, password: e.target.value })} className="mt-1.5 block h-9 w-44 rounded-sm border border-border bg-secondary px-3 text-sm text-foreground outline-none" placeholder="password"/></div>
          <div><label className="text-[11px] text-muted-foreground">角色</label><select value={newU.role} onChange={(e) => setNewU({ ...newU, role: e.target.value })} className="mt-1.5 block h-9 rounded-sm border border-border bg-secondary px-3 text-sm text-foreground"><option value="viewer">查看者</option><option value="admin">管理員</option></select></div>
          <Button type="button" onClick={addUser} disabled={!newU.username || newU.password.length < 8} className="h-9 rounded-sm px-4 text-xs font-semibold"><Plus size={15}/>新增</Button>
        </div>
      </section>
    </>}

    <AlertDialog open={!!delId} onOpenChange={(o) => { if (!o) setDelId(null); }}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>刪除此帳號？</AlertDialogTitle><AlertDialogDescription>刪除後該帳號將無法再登入，此動作無法復原。</AlertDialogDescription></AlertDialogHeader>
      <AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction onClick={doDelete} className="bg-negative text-white hover:bg-negative/90">確定刪除</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
    </AlertDialog>
    <AlertDialog open={!!resetId} onOpenChange={(o) => { if (!o) { setResetId(null); setResetPw(''); } }}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>重設密碼</AlertDialogTitle><AlertDialogDescription>請輸入新密碼（至少 8 個字元）。</AlertDialogDescription></AlertDialogHeader>
        <input type="password" value={resetPw} onChange={(e) => setResetPw(e.target.value)} className="h-10 w-full rounded-sm border border-border bg-secondary px-3 text-sm text-foreground outline-none" placeholder="新密碼"/>
      <AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction onClick={doResetPw}>確定重設</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
    </AlertDialog>
  </TradingShell>;
}

export function AdminHealthBadge() {
  return <ShieldCheck size={13} className="text-muted-foreground"/>;
}
