// Accès à la base de données.
// En ligne : PostgreSQL (Neon) via la variable DATABASE_URL.
// En local, sans DATABASE_URL : SQLite intégré à Node (fichier jackpool.db).
// Les requêtes sont écrites une seule fois, en SQL compatible avec les deux.

const usePg = !!process.env.DATABASE_URL;
let pool = null, lite = null;

if (usePg) {
  const { Pool, types } = require("pg");
  types.setTypeParser(20, (v) => Number(v)); // les grands entiers (dates, sommes) en nombres JavaScript
  // Neon ajoute parfois "channel_binding=require" à l'adresse : on le retire, la connexion reste chiffrée.
  const url = process.env.DATABASE_URL.trim().replace(/([?&])channel_binding=[^&]*&?/, "$1").replace(/[?&]$/, "");
  pool = new Pool({ connectionString: url, max: 5 });
} else {
  const { DatabaseSync } = require("node:sqlite");
  lite = new DatabaseSync(process.env.SQLITE_FILE || "jackpool.db");
  lite.exec("PRAGMA journal_mode=WAL");
}

// SQLite attend ?1, ?2… là où PostgreSQL attend $1, $2…
const toLite = (sql) => sql.replace(/\$(\d+)/g, "?$1");

function liteRun(sql, params = []) {
  const st = lite.prepare(toLite(sql));
  if (/^\s*(select|with)/i.test(sql) || /returning/i.test(sql)) return st.all(...params).map((r) => ({ ...r }));
  st.run(...params);
  return [];
}

// File d'attente : une seule écriture à la fois, pour que les soldes restent justes.
let chain = Promise.resolve();
function exclusive(fn) {
  const run = chain.then(fn, fn);
  chain = run.catch(() => {});
  return run;
}

async function query(sql, params = []) {
  if (usePg) return (await pool.query(sql, params)).rows;
  return liteRun(sql, params);
}

// Transaction : tout réussit ou rien n'est enregistré.
function tx(fn) {
  return exclusive(async () => {
    if (usePg) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const out = await fn({ query: async (s, p = []) => (await client.query(s, p)).rows });
        await client.query("COMMIT");
        return out;
      } catch (e) {
        await client.query("ROLLBACK").catch(() => {});
        throw e;
      } finally {
        client.release();
      }
    }
    lite.exec("BEGIN");
    try {
      const out = await fn({ query: async (s, p = []) => liteRun(s, p) });
      lite.exec("COMMIT");
      return out;
    } catch (e) {
      lite.exec("ROLLBACK");
      throw e;
    }
  });
}

async function init() {
  const ddl = [
    `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, name_key TEXT NOT NULL UNIQUE,
      pass TEXT NOT NULL, balance INTEGER NOT NULL, is_admin INTEGER NOT NULL DEFAULT 0, created BIGINT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL, created BIGINT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS bets (id TEXT PRIMARY KEY, game TEXT NOT NULL, lvl INTEGER NOT NULL, round BIGINT NOT NULL,
      user_id TEXT NOT NULL, choice TEXT NOT NULL, stake INTEGER NOT NULL, settled INTEGER NOT NULL DEFAULT 0)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS bets_one ON bets (game, lvl, round, user_id)`,
    `CREATE INDEX IF NOT EXISTS bets_open ON bets (settled, round)`,
    `CREATE TABLE IF NOT EXISTS rounds (game TEXT NOT NULL, lvl INTEGER NOT NULL, round BIGINT NOT NULL, result TEXT NOT NULL,
      pot INTEGER NOT NULL, winners INTEGER NOT NULL, players INTEGER NOT NULL, created BIGINT NOT NULL, PRIMARY KEY (game, lvl, round))`,
    `CREATE TABLE IF NOT EXISTS jackpots (game TEXT PRIMARY KEY, amount INTEGER NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS tickets (id TEXT PRIMARY KEY, game TEXT NOT NULL, user_id TEXT NOT NULL, choice TEXT NOT NULL,
      draw_at BIGINT NOT NULL, settled INTEGER NOT NULL DEFAULT 0)`,
    `CREATE INDEX IF NOT EXISTS tickets_open ON tickets (game, settled)`,
    `CREATE TABLE IF NOT EXISTS draws (game TEXT NOT NULL, draw_at BIGINT NOT NULL, result TEXT NOT NULL, amount INTEGER NOT NULL,
      winners INTEGER NOT NULL, PRIMARY KEY (game, draw_at))`,
    `CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
    // Gains de super cagnotte à annoncer au joueur à sa prochaine connexion (s'il n'était pas là au tirage)
    `CREATE TABLE IF NOT EXISTS notices (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, game TEXT NOT NULL, gain INTEGER NOT NULL,
      tickets INTEGER NOT NULL, created BIGINT NOT NULL, seen INTEGER NOT NULL DEFAULT 0)`,
    `CREATE INDEX IF NOT EXISTS notices_open ON notices (user_id, seen)`,
    // Commission encaissée par la banque, par jour (heure de Paris), par jeu et par source (parties / tickets).
    // human = la part payée par de vrais joueurs (le reste vient des bots).
    `CREATE TABLE IF NOT EXISTS fees (day TEXT NOT NULL, game TEXT NOT NULL, src TEXT NOT NULL, amount INTEGER NOT NULL,
      human INTEGER NOT NULL, PRIMARY KEY (day, game, src))`,
  ];
  for (const s of ddl) await query(s);
  // Ajout de la colonne « bot » aux bases déjà créées (ignoré si elle existe déjà)
  await query("ALTER TABLE users ADD COLUMN is_bot INTEGER NOT NULL DEFAULT 0").catch(() => {});
}

module.exports = { query, tx, exclusive, init, kind: usePg ? "postgres" : "sqlite" };
