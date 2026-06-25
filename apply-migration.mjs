import { readFileSync } from "node:fs";
import postgres from "postgres";

function loadEnv() {
  for (const f of [".env.local", ".env"]) {
    let txt;
    try {
      txt = readFileSync(f, "utf8");
    } catch {
      continue;
    }
    for (const line of txt.split("\n")) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

loadEnv();
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL missing");
  process.exit(1);
}

const sqlPath = process.argv[2];
const raw = readFileSync(sqlPath, "utf8");
const statements = raw
  .split("--> statement-breakpoint")
  .map((s) => s.trim())
  .filter(Boolean);

const sql = postgres(url, { max: 1, onnotice: () => {} });

let applied = 0;
try {
  for (const stmt of statements) {
    await sql.unsafe(stmt);
    applied++;
  }
  console.log(`OK — ${applied}/${statements.length} statements applied`);
} catch (err) {
  console.error(`FAIL at statement ${applied + 1}/${statements.length}:`, err.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
