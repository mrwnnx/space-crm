import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;

const globalForDb = globalThis as unknown as { __pgClient?: ReturnType<typeof postgres> };

const client =
  globalForDb.__pgClient ??
  postgres(connectionString, { prepare: false, max: 5 });

if (process.env.NODE_ENV !== "production") globalForDb.__pgClient = client;

export const db = drizzle(client, { schema });

export type DbExecutor = Pick<typeof db, "insert" | "update" | "delete" | "query">;
