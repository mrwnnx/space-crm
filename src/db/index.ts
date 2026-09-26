import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;

type Client = ReturnType<typeof postgres>;
const globalForDb = globalThis as unknown as { __pgClient?: Client };

function creer(): Client {
  const c = postgres(connectionString, {
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
  // Ce que drizzle() règle sur le client à sa création : un client neuf (après
  // recyclage) doit lire les dates exactement comme le premier.
  const brut = (v: unknown) => v;
  const parsers = c.options.parsers as unknown as Record<string, unknown>;
  const serializers = c.options.serializers as unknown as Record<string, unknown>;
  for (const type of ["1184", "1082", "1083", "1114", "1182", "1185", "1115", "1231"]) {
    parsers[type] = brut;
    serializers[type] = brut;
  }
  serializers["114"] = brut;
  serializers["3802"] = brut;
  return c;
}

/*
 * Garde-fou contre les connexions mortes (audit 26/09 : 265 pages figées
 * 300 s en 7 jours, alors que la base coupe toute requête à 2 min). Une
 * instance Vercel gelée entre deux requêtes garde des connexions que le
 * pooler a fermées ; la requête suivante attend une réponse qui ne vient
 * jamais. Si une requête dépasse DELAI, le pool entier est jeté et remplacé :
 * la page en cours échoue vite, les suivantes repartent sur du neuf.
 */
const DELAI = Number(process.env.DB_DELAI_MS) || 60_000;
let courant: Client = globalForDb.__pgClient ?? creer();
if (process.env.NODE_ENV !== "production") globalForDb.__pgClient = courant;

function recycler(vieux: Client) {
  if (courant !== vieux) return; // déjà remplacé par une autre requête bloquée
  console.error(`DB : requête sans réponse après ${DELAI / 1000} s — connexions recyclées`);
  courant = creer();
  if (process.env.NODE_ENV !== "production") globalForDb.__pgClient = courant;
  vieux.end({ timeout: 5 }).catch(() => {});
}

// La requête de postgres.js ne part qu'à son premier `then` : c'est là que le
// chrono démarre. Ses méthodes (`values()`…) renvoient la requête elle-même,
// qu'on garde enveloppée pour ne pas perdre le chrono.
function surveiller<T extends object>(c: Client, q: T): T {
  const enveloppe: T = new Proxy(q, {
    get(cible, prop) {
      if (prop === "then") {
        return (ok?: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => {
          const chrono = setTimeout(() => recycler(c), DELAI);
          return (cible as unknown as Promise<unknown>).then(
            (v) => {
              clearTimeout(chrono);
              return ok ? ok(v) : v;
            },
            (e) => {
              clearTimeout(chrono);
              if (ko) return ko(e);
              throw e;
            }
          );
        };
      }
      const v = Reflect.get(cible, prop, cible);
      if (typeof v !== "function") return v;
      return (...args: unknown[]) => {
        const r = (v as (...a: unknown[]) => unknown).apply(cible, args);
        return r === cible ? enveloppe : r;
      };
    },
  });
  return enveloppe;
}

// Le client vu par drizzle : toujours le pool courant, requêtes surveillées.
const client = new Proxy(courant, {
  get(_cible, prop) {
    const c = courant;
    if (prop === "unsafe") {
      return (...args: Parameters<Client["unsafe"]>) => surveiller(c, c.unsafe(...args));
    }
    const v = Reflect.get(c, prop, c);
    return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(c) : v;
  },
  apply(_cible, _this, args) {
    return (courant as unknown as (...a: unknown[]) => unknown)(...args);
  },
});

export const db = drizzle(client, { schema });

export type DbExecutor = Pick<typeof db, "insert" | "update" | "delete" | "query">;
