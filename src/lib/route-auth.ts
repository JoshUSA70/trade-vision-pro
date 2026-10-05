// 頁面路由保護：beforeLoad 用（server-side 驗 session）
import { createMiddleware, createServerFn } from '@tanstack/react-start';
import { redirect } from '@tanstack/react-router';
import { getSessionUser, type SessionUser } from './auth';

const withRequest = createMiddleware({ type: 'request' }).server(async ({ next, request }) => {
  return next({ context: { request } });
});

export const getAuthState = createServerFn({ method: 'GET' })
  .middleware([withRequest])
  .handler(async ({ context }): Promise<{ user: SessionUser | null }> => {
    const req = (context as unknown as { request: Request }).request;
    return { user: getSessionUser(req) };
  });

/** 需登入的頁面：未登入導向 /login */
export async function requirePageAuth({ location }: { location: { pathname: string } }): Promise<void> {
  if (location.pathname === '/login') return;
  const { user } = await getAuthState();
  if (!user) throw redirect({ to: '/login' as never });
}

/** 管理員頁面：未登入導向 /login，非管理員導向首頁 */
export async function requireAdminPage(): Promise<void> {
  const { user } = await getAuthState();
  if (!user) throw redirect({ to: '/login' as never });
  if (user.role !== 'admin') throw redirect({ to: '/' });
}

/** 登入頁：已登入導向首頁 */
export async function redirectIfAuthed(): Promise<void> {
  const { user } = await getAuthState();
  if (user) throw redirect({ to: '/' });
}
