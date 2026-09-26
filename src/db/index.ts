import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;

const globalForDb = globalThis as unknown as { __pgClient?: ReturnType<typeof postgres> };

const client =
  globalForDb.__pgClient ??
  postgres(connectionString, {
    prepare: false, // requis pour le pooler transaction (Supavisor :6543)
    max: 10, // ≥ concurrence d'une requête (la page tire 6 requêtes en //) : sous le pool, le pooler transaction fige les connexions pipelinées → gel. Prouvé : max:5 gèle, max:10 stable.
    idle_timeout: 20, // ferme les idle AVANT que Supavisor les coupe → plus de connexion zombie
    connect_timeout: 10, // échoue vite au lieu de pendre si pas de connexion
    max_lifetime: 60 * 30, // recycle les connexions toutes les 30 min
    // Pas de relecture des types à chaque connexion : 10 Ko par connexion, ~2 900
    // connexions/jour (idle_timeout court) → ~30 Mo/jour de transfert Supabase
    // pour rien (mesuré le 26/09, 1ʳᵉ ligne de pg_stat_statements). Conséquence :
    // un tableau SQL arrive en texte « {a,b} » → renvoyer du JSON (to_jsonb).
    fetch_types: false,
  });

if (process.env.NODE_ENV !== "production") globalForDb.__pgClient = client;

export const db = drizzle(client, { schema });

export type DbExecutor = Pick<typeof db, "insert" | "update" | "delete" | "query">;
