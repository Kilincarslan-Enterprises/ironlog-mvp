/**
 * Test stub for `@hono/clerk-auth`.
 *
 * The backend test suite exercises the agent-API-token auth path exclusively, so
 * Clerk JWT verification is not needed. The real `clerkMiddleware()` constructs a
 * Clerk client from `CLERK_SECRET_KEY` and rejects a dummy key; this stub makes
 * the middleware a no-op and `getAuth()` report no Clerk user, which makes
 * `resolveUser()` fall through to the agent-token branch in `auth.ts` — the
 * exact path under test.
 */

// Hono middleware shape: () => (ctx, next) => Promise<void>.
export function clerkMiddleware() {
  return async (_c: any, next: () => Promise<void>) => {
    await next();
  };
}

// `resolveUser()` only reads `auth?.userId`; report none so it falls back to the
// agent API token.
export function getAuth(): { userId: string | null } {
  return { userId: null };
}