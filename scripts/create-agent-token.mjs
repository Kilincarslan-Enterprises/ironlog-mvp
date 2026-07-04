#!/usr/bin/env node
// Provision an agent API token for an existing user.
//
// Usage:
//   node scripts/create-agent-token.mjs <userId> [label] [--expires-days 90]
//
// The script hashes a freshly generated random secret with SHA-256, inserts a
// row into the `agent_api_tokens` D1 table (via the local D1 instance unless
// `--remote` is passed), and prints the raw token ONCE — store it securely,
// only the hash is persisted.
//
// Examples:
//   node scripts/create-agent-token.mjs 4f2c... "Cron importer" --expires-days 90
//   node scripts/create-agent-token.mjs 4f2c... "Cron importer" --remote

import { execSync } from "node:child_process";

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error(
    "Usage: node scripts/create-agent-token.mjs <userId> [label] [--expires-days N] [--remote]"
  );
  process.exit(1);
}

const userId = args[0];
const remote = args.includes("--remote");
let label = "agent";
let expiresDays = null;
for (let i = 1; i < args.length; i++) {
  const a = args[i];
  if (a === "--expires-days") {
    expiresDays = Number(args[++i]);
  } else if (a !== "--remote") {
    label = a;
  }
}

// 32-byte random secret, URL-safe base64.
const secret =
  typeof crypto !== "undefined" && crypto.randomUUID
    ? btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "")
    : execSync("openssl rand -base64 32").toString().trim();

// SHA-256 hex of the secret (must match functions/api/auth.ts#hashSecret).
const hashJs = `
const data = new TextEncoder().encode(${JSON.stringify(secret)});
crypto.subtle.digest("SHA-256", data).then((buf) => {
  console.log(Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join(""));
});
`;
const hashed = execSync(`node --input-type=module -e ${JSON.stringify(hashJs)}`)
  .toString()
  .trim();

const tokenId = crypto.randomUUID();
const now = Date.now();
const expiresAt = expiresDays ? now + expiresDays * 86400_000 : null;

const values = {
  id: tokenId,
  user_id: userId,
  label,
  hashed_secret: hashed,
  scopes: "read",
  last_used_at: null,
  expires_at: expiresAt,
  is_revoked: 0,
  created_at: now,
  updated_at: now,
};

const target = remote ? "--remote" : "--local";
const sql = `INSERT INTO agent_api_tokens (id, user_id, label, hashed_secret, scopes, last_used_at, expires_at, is_revoked, created_at, updated_at) VALUES ('${values.id}', '${values.user_id}', '${values.label}', '${values.hashed}', '${values.scopes}', NULL, ${expiresAt === null ? "NULL" : expiresAt}, 0, ${now}, ${now});`;

execSync(
  `npx wrangler d1 execute ironlog-mvp-db ${target} --command ${JSON.stringify(sql)}`,
  { stdio: "inherit" }
);

console.log("\n==================================================");
console.log("Agent API token created (store securely — shown once):");
console.log(secret);
console.log("==================================================");
console.log(`Token id: ${tokenId}`);
console.log(`User:     ${userId}`);
console.log(`Label:    ${label}`);
console.log(`Expires:  ${expiresAt === null ? "never" : new Date(expiresAt).toISOString()}`);
console.log(`Target:   ${remote ? "remote D1" : "local D1 (--remote to write to production)"}`);
console.log("\nUse it with: Authorization: Bearer <token>   or   x-api-token: <token>");