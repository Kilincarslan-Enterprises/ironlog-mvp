import { handle } from "hono/cloudflare-pages";
import { app } from "./app";

// Re-export so anything importing the Pages entry can still reach the app.
export { app };

// Cloudflare Pages Functions entry — wraps the shared Hono app for the
// Pages runtime. The app itself (middleware + routes) lives in `./app.ts`,
// extracted so the backend test suite can exercise it directly via
// `app.request(...)` without importing the bracketed catch-all filename or
// pulling in the Pages `handle()` wrapper.
export const onRequest = handle(app);