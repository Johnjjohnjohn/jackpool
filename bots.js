// Jackpool : bots de la version de test.
// Ils jouent aux tables avec des crédits virtuels, sont marqués comme bots (badge 🤖)
// et ne s'allument que si la variable BOTS_PER_TABLE est réglée sur Render (ex. 10).
// Sans cette variable, aucun bot ne joue.

const crypto = require("crypto");

// Prénoms commençant par B, de langues variées
const NAMES = [
  "Bruno", "Beatriz", "Björn", "Bogdan", "Bashir", "Bianca", "Boris", "Brigitte", "Bilal", "Bao",
  "Bernardo", "Bojana", "Baraka", "Bukola", "Bayu", "Benoît", "Berit", "Bartosz", "Bálint", "Barış",
  "Burak", "Begoña", "Blanca", "Bastian", "Bettina", "Brendan", "Bríd", "Bronwen", "Bahar", "Behrouz",
  "Babajide", "Bolat", "Batbayar", "Bayarmaa", "Bích", "Bongani", "Bruna", "Benedikt", "Bente", "Bjarne",
  "Bertrand", "Blaise", "Brahim", "Badria", "Basma", "Boaz", "Batya", "Bogusław", "Branka", "Božidar",
  "Bao Anh", "Bomi", "Byung", "Bunko", "Benjiro", "Bhavna", "Bharat", "Bijoy", "Bipasha", "Bruce",
  "Bonnie", "Brianna", "Beto", "Benicio", "Belén", "Bautista", "Benedita", "Bento", "Bastien", "Bérénice",
  "Bodil", "Birger", "Brynja", "Baldur", "Bogi", "Bea", "Bettino", "Brunella", "Benvenuto", "Bakari",
];

function botName(i) {
  // i commence à 0 ; le nombre suit le prénom : « Bruno btz1 »
  return `${NAMES[i % NAMES.length]} btz${i + 1}`;
}

/**
 * Démarre les bots.
 * api : fonctions du serveur { db, GAMES, STAKES, START_BALANCE, ROUND_MS, placeBet, buyTicket, currentRound(), tableKeys }
 */
async function startBots(api) {
  const perTable = Math.min(20, Math.max(0, Number(process.env.BOTS_PER_TABLE || 0)));
  if (!perTable) return [];
  const { db, GAMES, STAKES, START_BALANCE, ROUND_MS } = api;

  // Une table = un jeu + un niveau de mise. Chaque bot reste à sa table.
  const tables = [];
  for (const g in GAMES) STAKES.forEach((_, lvl) => tables.push({ game: g, lvl }));

  const bots = [];
  let i = 0;
  for (const t of tables) {
    for (let k = 0; k < perTable; k++, i++) {
      const name = botName(i), key = name.toLowerCase();
      let row = (await db.query("SELECT id, name FROM users WHERE name_key=$1", [key]))[0];
      if (!row) {
        const id = crypto.randomUUID();
        // Mot de passe aléatoire jamais communiqué : personne ne peut se connecter avec un compte bot.
        await db.query("INSERT INTO users (id,name,name_key,pass,balance,is_admin,is_bot,created) VALUES ($1,$2,$3,$4,$5,0,1,$6)",
          [id, name, key, "bot:" + crypto.randomBytes(32).toString("hex"), START_BALANCE, Date.now()]);
        row = { id, name };
      }
      bots.push({ c: { user: { id: row.id, name: row.name, bot: true } }, game: t.game, lvl: t.lvl, round: -1 });
    }
  }

  // À chaque nouveau tour, chaque bot mise (la plupart du temps) à un moment au hasard.
  async function play(b) {
    const round = api.currentRound();
    if (b.round === round) return;
    b.round = round;
    if (Math.random() < 0.15) return; // passe ce tour
    const closes = (round + 1) * ROUND_MS;
    const delay = 2000 + Math.random() * Math.max(1000, closes - Date.now() - 6000);
    setTimeout(async () => {
      try {
        if (api.currentRound() !== round) return;
        const stake = STAKES[b.lvl];
        // Plus assez de crédits : le bot se recharge, comme un joueur avec le bouton « Recharger »
        const bal = (await db.query("SELECT balance FROM users WHERE id=$1", [b.c.user.id]))[0];
        if (!bal || bal.balance < stake) await db.query("UPDATE users SET balance=$1 WHERE id=$2", [START_BALANCE, b.c.user.id]);
        const out = GAMES[b.game].out;
        await api.placeBet(b.c, { game: b.game, lvl: b.lvl, choice: out[crypto.randomInt(out.length)] });
        // De temps en temps, un ticket de super cagnotte
        if (Math.random() < 0.03) await api.buyTicket(b.c, { game: b.game, choice: out[crypto.randomInt(out.length)] });
      } catch (e) { /* mise refusée (tour fermé…) : on attend le tour suivant */ }
    }, delay);
  }
  setInterval(() => bots.forEach(play), 1000);
  console.log(`${bots.length} bots en jeu (${perTable} par table).`);
  return bots;
}

module.exports = { startBots, botName };
