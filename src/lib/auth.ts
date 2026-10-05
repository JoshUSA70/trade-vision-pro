// 登入認證：scrypt 密碼雜湊＋HMAC-SHA256 簽名 session cookie（server-side 專用）
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'tvs_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type SessionUser = { id: string; username: string; role: 'admin' | 'viewer' };

let secretWarned = false;
function sessionSecret(): string {
  const s = process.env['SESSION_SECRET'];
  if (s) return s;
  if (!secretWarned) {
    secretWarned = true;
    console.warn('[auth] SESSION_SECRET 未設定，使用隨機密鑰（重部署後需重新登入）。建議在 Vercel 加上 SESSION_SECRET。');
  }
  // 退回：process 內快取的隨機密鑰
  const g = globalThis as unknown as { __tvs_secret?: string };
  if (!g.__tvs_secret) g.__tvs_secret = randomBytes(32).toString('hex');
  return g.__tvs_secret;
}

function b64urlEncode(buf: Buffer | string): string {
  return Buffer.from(buf).toString('base64url');
}
function b64urlDecode(s: string): Buffer {
  return Buffer.from(s, 'base64url');
}

/** 密碼雜湊：scrypt$salt$hash */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [algo, salt, hash] = stored.split('$');
    if (algo !== 'scrypt' || !salt || !hash) return false;
    const check = scryptSync(password, salt, 64).toString('hex');
    const a = Buffer.from(check, 'hex');
    const b = Buffer.from(hash, 'hex');
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function signSession(user: SessionUser): string {
  const payload = b64urlEncode(JSON.stringify({ ...user, exp: Date.now() + SESSION_TTL_MS }));
  const sig = createHmac('sha256', sessionSecret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifySession(token: string): SessionUser | null {
  try {
    const [payload, sig] = token.split('.');
    if (!payload || !sig) return null;
    const expect = createHmac('sha256', sessionSecret()).update(payload).digest('base64url');
    const a = b64urlDecode(sig);
    const b = b64urlDecode(expect);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const data = JSON.parse(b64urlDecode(payload).toString('utf8')) as SessionUser & { exp: number };
    if (typeof data.exp !== 'number' || data.exp < Date.now()) return null;
    if (!data.id || !data.username) return null;
    return { id: data.id, username: data.username, role: data.role === 'admin' ? 'admin' : 'viewer' };
  } catch {
    return null;
  }
}

export function getCookieValue(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    if (part.slice(0, idx).trim() === name) return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return null;
}

/** 從 Request 解析 session；無效回 null */
export function getSessionUser(req: Request): SessionUser | null {
  const token = getCookieValue(req.headers.get('cookie'), SESSION_COOKIE);
  if (!token) return null;
  return verifySession(token);
}

export function sessionCookieHeader(token: string): string {
  const secure = process.env['NODE_ENV'] === 'production' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=${SESSION_TTL_MS / 1000}`;
}

export function clearSessionCookieHeader(): string {
  const secure = process.env['NODE_ENV'] === 'production' ? '; Secure' : '';
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=0`;
}

/** API 路由用：驗證 session，未登入回傳 401 Response（呼叫端直接 return） */
export function requireApiUser(req: Request): SessionUser | Response {
  const user = getSessionUser(req);
  if (!user) {
    return Response.json({ ok: false, error: '未登入' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }
  return user;
}

/** API 路由用：驗證管理員，未授權回傳 403/401 Response */
export function requireApiAdmin(req: Request): SessionUser | Response {
  const r = requireApiUser(req);
  if (r instanceof Response) return r;
  if (r.role !== 'admin') {
    return Response.json({ ok: false, error: '需要管理員權限' }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
  }
  return r;
}
