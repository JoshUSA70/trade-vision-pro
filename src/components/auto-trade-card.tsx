import { useCallback, useEffect, useState } from 'react';
import { Bot, Play, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { SectionHeading, SymbolCell } from '@/components/trading-shell';
import { CANDIDATE_POOL } from '@/lib/screener';
import { money } from '@/lib/trading-demo';

type Trade = {
  symbol: string; side: string; qty: number; price: number | null;
  executed_at: string; auto: boolean;
};

// 下一次週一～週五 22:35（台灣時間；美東夏令 10:35／冬令 9:35，開盤後第一根 5分K 確認完）
function nextRunText(): string {
  const taipeiNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));
  const cand = new Date(taipeiNow);
  cand.setHours(22, 35, 0, 0);
  const isWeekday = (d: Date) => d.getDay() >= 1 && d.getDay() <= 5;
  if (cand.getTime() <= taipeiNow.getTime() || !isWeekday(cand)) {
    do { cand.setDate(cand.getDate() + 1); } while (!isWeekday(cand));
  }
  const wd = ['日', '一', '二', '三', '四', '五', '六'][cand.getDay()];
  return `${cand.getMonth() + 1}/${cand.getDate()}（${wd}）22:35`;
}

export function AutoTradeCard() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [src, setSrc] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [testing, setTesting] = useState(false);
  const [minScore, setMinScore] = useState(75);
  const [maxBuys, setMaxBuys] = useState(3);
  useEffect(() => {
    (async () => {
      try {
        const d = await (await fetch('/api/trade-config')).json() as { minScore?: number; maxBuys?: number };
        if (typeof d.minScore === 'number') setMinScore(d.minScore);
        if (typeof d.maxBuys === 'number') setMaxBuys(d.maxBuys);
      } catch { /* 用預設值 */ }
    })();
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const r = await fetch('/api/cron/history');
      const data = await r.json() as { source: string; trades: Trade[] };
      if (Array.isArray(data.trades)) { setTrades(data.trades); setSrc(data.source); }
    } catch { /* 保持空白 */ }
  }, []);
  useEffect(() => { void loadHistory(); }, [loadHistory]);

  async function manualRun() {
    setRunning(true);
    try {
      const r = await fetch('/api/cron/test');
      const data = await r.json() as { success: boolean; orders?: Array<{ symbol: string }>; stopped?: string; error?: string; qualified?: number; minScore?: number };
      if (data.stopped) toast.warning('已停止', { description: data.stopped });
      else if (data.error) toast.error('執行失敗', { description: data.error });
      else if (data.orders && data.orders.length > 0) {
        toast.success(`自動下單完成：${data.orders.map((o) => o.symbol).join(', ')}`);
      } else {
        toast.info(`執行完成：今日無符合 Score≥${data.minScore ?? minScore} 的標的`);
      }
      void loadHistory();
    } catch (e) {
      toast.error('執行失敗', { description: e instanceof Error ? e.message : '請稍後再試' });
    } finally {
      setRunning(false);
      setConfirmOpen(false);
    }
  }

  async function testTelegram() {
    setTesting(true);
    try {
      const r = await fetch('/api/telegram/test');
      const data = await r.json() as { ok: boolean; error?: string };
      if (data.ok) toast.success('Telegram 測試訊息已發送，請查看你的 Telegram');
      else toast.error('Telegram 測試失敗', { description: data.error });
    } catch (e) {
      toast.error('Telegram 測試失敗', { description: e instanceof Error ? e.message : '請稍後再試' });
    } finally { setTesting(false); }
  }

  return (
    <section className="mb-7 overflow-hidden rounded-sm border border-border bg-card">
      <SectionHeading
        title="自動交易狀態"
        subtitle="Auto trading"
        action={<span className="flex items-center gap-2 text-[11px] text-muted-foreground"><Bot size={15} className="text-primary" /> 已啟用 ✅</span>}
      />
      <div className="grid gap-6 px-6 py-5 lg:grid-cols-2">
        <div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><p className="text-[11px] text-muted-foreground">下次執行時間</p><p className="mt-1 text-sm font-semibold text-foreground">{nextRunText()}（開盤5分K確認後）</p></div>
            <div><p className="text-[11px] text-muted-foreground">排程</p><p className="mt-1 text-sm font-semibold text-foreground">週一～週五 · 智能選股＋四因子＋盤中5分K確認 · 門檻 {minScore} 分</p></div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={() => setConfirmOpen(true)} disabled={running} className="h-8 rounded-sm text-xs font-semibold">
              <Play size={14} />{running ? '執行中…' : '立即手動執行掃描+下單'}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={testTelegram} disabled={testing} className="h-8 rounded-sm text-xs">
              <Send size={14} />{testing ? '發送中…' : '測試 Telegram'}
            </Button>
          </div>
          {src === 'alpaca' && <p className="mt-3 text-[11px] text-subtle">Supabase 未設定，顯示 Alpaca 今日訂單。</p>}
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground">今日自動交易紀錄（{trades.length} 筆）</p>
          {trades.length === 0 ? (
            <p className="mt-2 text-sm text-subtle">今日尚無交易紀錄。</p>
          ) : (
            <ul className="mt-2 max-h-44 space-y-2 overflow-y-auto">
              {trades.map((t, i) => (
                <li key={`${t.symbol}-${t.executed_at}-${i}`} className="flex items-center justify-between rounded-sm border border-border bg-secondary/50 px-3 py-2 text-xs">
                  <SymbolCell symbol={t.symbol} name={t.symbol} />
                  <span className={`font-semibold ${t.side === 'BUY' ? 'text-positive' : 'text-negative'}`}>{t.side === 'BUY' ? '買入' : '賣出'} {t.qty} 股</span>
                  <span className="tabular-nums text-muted-foreground">{t.price !== null ? money(t.price) : '—'}</span>
                  {t.auto && <span className="rounded-sm bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">自動</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認手動執行</AlertDialogTitle>
            <AlertDialogDescription>
              將立即執行一次完整流程：智能選股（約 {CANDIDATE_POOL.length} 檔候選）→ 日線四因子評分 → 盤中 5分K 確認 → 對最終分數≥{minScore} 的標的最多買入 {maxBuys} 檔（每檔 1 股，Alpaca 模擬帳戶市價單）。確定執行嗎？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={running}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); void manualRun(); }} disabled={running}>
              {running ? '執行中…' : '確認執行'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
