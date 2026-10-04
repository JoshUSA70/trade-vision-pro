// Telegram 通知共用模組（server 端使用）

export async function sendTelegram(text: string): Promise<{ ok: boolean; error?: string }> {
  const token = process.env['TELEGRAM_BOT_TOKEN'];
  const chatId = process.env['TELEGRAM_CHAT_ID'];
  if (!token || !chatId) {
    return { ok: false, error: '請在 Vercel 設定 TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID' };
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, parse_mode: 'Markdown', text }),
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string };
    if (!res.ok || data.ok === false) {
      return { ok: false, error: data.description || `Telegram 發送失敗（${res.status}）` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Telegram 發送異常' };
  }
}
