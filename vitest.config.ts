import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Backend test configuration.
 *
 * Tests run inside the Cloudflare Workers runtime via @cloudflare/vitest-pool-workers,
 * so the Hono app sees a real `D1Database` binding (`env.DB`, provisioned from
 * `wrangler.toml`'s `[[d1_databases]]` by Miniflare) and the same
 * `c.env`/`crypto.subtle`/`crypto.randomUUID` surface it has in production.
 *
 * The migration SQL is applied to the test D1 in `beforeAll`, a test user +
 * agent API token are seeded directly, and every request authenticates with the
 * agent token (`x-api-token`) — which exercises the real token-auth path in
 * `auth.ts`. `@hono/clerk-auth` is stubbed out (see `test/stubs/clerk-auth.ts`)
 * so the suite does not depend on a valid Clerk secret key; `getAuth()` reports
 * no Clerk user, making `resolveUser()` fall through to the agent-token branch.
 */
export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.toml" },
      miniflare: {
        bindings: {
          CLERK_SECRET_KEY: "sk_test_dummy_for_vitest",
          CLERK_PUBLISHABLE_KEY: "pk_test_dummy_for_vitest",
        },
      },
    }),
  ],
  resolve: {
    alias: {
      "@hono/clerk-auth": resolve(__dirname, "test/stubs/clerk-auth.ts"),
    },
  },
  test: {
    include: ["test/**/*.test.ts"],
  },
});