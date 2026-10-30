// Jackpool : bots de test.
// Lance une copie privée du serveur sur une base jetable (jamais la base en ligne),
// y fait jouer des bots sur les six jeux, déclenche les super cagnottes,
// puis vérifie que chaque crédit est bien compté.
//
// Utilisation :  node test/bots.js
// Réglages facultatifs : BOTS=60 ROUNDS=20 ROUND_MS=4000 node test/bots.js

const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");
const WebSocket = require("ws");

const BOTS = Number(process.env.BOTS || 60);
const ROUNDS = Number(process.env.ROUNDS || 20);
const ROUND_MS = Number(process.env.ROUND_MS || 4000);
const PORT = 3900 + Math.floor(Math.random() * 90);
const BASE = `http://127.0.0.1:${PORT}`;
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), "jackpool-bots-"));
const DBFILE = path.join(DIR, "test.db");

// Mêmes règles que le site
const STAKES = [100, 500, 2000], TICKET = 200, FEE = 0.05, START = 10000;
const START_JACKPOT = { pof: 4275, de: 5840, paille: 3120, couleur: 4750, bataille: 3610, gobelets: 5225 };
const OUT = { pof: ["P", "F"], de: ["1", "2", "3", "4", "5", "6"], paille: ["1", "2", "3"], couleur: ["H", "D", "C", "S"], bataille: ["G", "D"], gobelets: ["1", "2", "3", "4", "5"] };
const NAMES = { pof: "Pile ou face", de: "Dé", paille: "Courte paille", couleur: "La Couleur", bataille: "La Bataille", gobelets: "Les gobelets" };
const GAMES = Object.keys(OUT);

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cr = (c) => (c / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " cr";
const problems = [];
const fail = (m) => problems.push(m);

// ---------- Serveur privé ----------
function startServer() {
  const srv = spawn(process.execPath, [path.join(__dirname, "..", "server.js")], {
    env: { ...process.env, DATABASE_URL: "", PORT: String(PORT), ROUND_MS: String(ROUND_MS), SQLITE_FILE: DBFILE },
    stdio: ["ignore", "pipe", "pipe"],
  });
  srv.stderr.on("data", (d) => { const s = String(d); if (!/ExperimentalWarning|--trace-warnings/.test(s)) fail("Erreur du serveur : " + s.trim()); });
  return new Promise((ok, ko) => {
    srv.stdout.on("data", (d) => { if (/en ligne/.test(String(d))) ok(srv); });
    srv.on("exit", (c) => ko(new Error("Le serveur s'est arrêté (code " + c + ")")));
  });
}

async function register(name) {
  const r = await fetch(BASE + "/api/register", { method: "POST", body: JSON.stringify({ name, pass: "test-" + name }) });
  const j = await r.json();
  if (!j.token) throw new Error("Inscription impossible pour " + name + " : " + j.error);
  return j.token;
}

// ---------- Un bot ----------
class Bot {
  constructor(name, token) {
    this.name = name; this.token = token;
    this.expected = START; // solde attendu, calculé de son côté
    this.balance = START;  // solde annoncé par le serveur
    this.game = pick(GAMES); this.lvl = 0;
    this.round = -1; this.results = []; this.errors = []; this.ticketsBought = 0; this.pendingTickets = 0;
    this.notified = []; // annonces de gains de super cagnotte reçues
  }
  connect() {
    return new Promise((ok) => {
      this.ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws?token=${this.token}`);
      this.ws.on("message", (raw) => this.on(JSON.parse(raw)));
      this.ws.on("open", () => { this.send({ t: "sub", game: this.game, lvl: this.lvl }); ok(); });
    });
  }
  send(m) { if (this.ws.readyState === 1) this.ws.send(JSON.stringify(m)); }
  on(m) {
    if (m.t === "balance") this.balance = m.balance;
    else if (m.t === "table" && m.round > this.round) { this.round = m.round; this.newRound(m); }
    else if (m.t === "result" && m.game === this.game && m.lvl === this.lvl) this.onResult(m);
    else if (m.t === "bigdraw" && m.mine && m.mine.gain) this.notified.push({ game: m.game, gain: m.mine.gain, live: true });
    else if (m.t === "biggain") this.notified.push(m);
    else if (m.t === "tickets" && this.pendingTickets) { this.pendingTickets--; }
    else if (m.t === "error") {
      if (m.req === "ticket") { this.ticketsBought--; this.expected += TICKET; this.pendingTickets = Math.max(0, this.pendingTickets - 1); }
      this.errors.push(m.message);
    }
  }
  newRound(m) {
    if (!this.active) return;
    // Change parfois de table entre deux tours
    if (Math.random() < 0.3) {
      this.game = pick(GAMES);
      const x = Math.random(); this.lvl = x < 0.6 ? 0 : x < 0.9 ? 1 : 2;
      this.send({ t: "sub", game: this.game, lvl: this.lvl });
    }
    if (Math.random() < 0.15) return; // passe ce tour
    const left = m.closesAt - m.now;
    const delay = 150 + Math.random() * Math.max(200, left - 1600);
    setTimeout(() => {
      if (this.balance < STAKES[this.lvl]) return;
      const g = this.game, l = this.lvl;
      this.send({ t: "bet", game: g, lvl: l, choice: pick(OUT[g]) });
      // Parfois change d'avis, ou annule sa mise
      const r = Math.random();
      if (r < 0.1) setTimeout(() => this.send({ t: "bet", game: g, lvl: l, choice: pick(OUT[g]) }), 150);
      else if (r < 0.15) setTimeout(() => this.send({ t: "bet", game: g, lvl: l, choice: null }), 150);
      // Parfois achète un ticket de super cagnotte
      if (Math.random() < 0.12 && this.balance >= STAKES[l] + TICKET) {
        this.ticketsBought++; this.pendingTickets++; this.expected -= TICKET;
        this.send({ t: "ticket", game: g, choice: pick(OUT[g]) });
      }
    }, delay);
  }
  onResult(m) {
    this.results.push(m);
    if (m.mine) this.expected += m.mine.gain - STAKES[m.lvl];
  }
}

// ---------- Vérifications ----------
function check(bots, startedRound) {
  const { DatabaseSync } = require("node:sqlite");
  const db = new DatabaseSync(DBFILE);
  const all = (s, ...p) => db.prepare(s).all(...p).map((r) => ({ ...r }));

  const users = all("SELECT id, name, balance FROM users");
  const jackpots = all("SELECT game, amount FROM jackpots");
  const rounds = all("SELECT * FROM rounds ORDER BY round");
  const bets = all("SELECT * FROM bets");
  const tickets = all("SELECT * FROM tickets");
  const draws = all("SELECT * FROM draws");

  // 1. Aucun solde négatif
  for (const u of users) if (u.balance < 0) fail(`${u.name} a un solde négatif : ${cr(u.balance)}`);

  // 2. Chaque partie recalculée à la main d'après les mises enregistrées
  let feeRounds = 0;
  const stats = {}; // jeu -> { parties, joueurs, mises, résultats }
  const outcomes = { split: 0, allwin: 0, nobody: 0, tie: 0 };
  for (const r of rounds) {
    const res = JSON.parse(r.result);
    const rb = bets.filter((b) => b.game === r.game && b.lvl === r.lvl && b.round === r.round);
    const pot = rb.reduce((a, b) => a + b.stake, 0);
    const win = res.win === null ? [] : rb.filter((b) => b.choice === res.win);
    if (rb.length !== r.players) fail(`${NAMES[r.game]} tour ${r.round} : ${r.players} joueurs annoncés, ${rb.length} mises trouvées`);
    if (pot !== r.pot) fail(`${NAMES[r.game]} tour ${r.round} : cagnotte ${cr(r.pot)} annoncée, ${cr(pot)} recalculée`);
    if (win.length !== r.winners) fail(`${NAMES[r.game]} tour ${r.round} : ${r.winners} gagnants annoncés, ${win.length} recalculés`);
    if (rb.some((b) => b.stake !== STAKES[r.lvl])) fail(`${NAMES[r.game]} tour ${r.round} : une mise n'a pas le montant de la table`);
    if (res.win !== null && !OUT[r.game].includes(res.win)) fail(`${NAMES[r.game]} : résultat impossible « ${res.win} »`);
    if (r.game === "bataille") {
      const exp = res.l.v > res.r.v ? "G" : res.r.v > res.l.v ? "D" : null;
      if (exp !== res.win) fail(`La Bataille tour ${r.round} : mauvais vainqueur désigné`);
    }
    if (r.game === "couleur" && res.c.s !== res.win) fail(`La Couleur tour ${r.round} : la couleur annoncée ne correspond pas à la carte`);
    // Commission prélevée
    if (!win.length) { feeRounds += pot - Math.floor(pot * 0.95); outcomes[res.win === null ? "tie" : "nobody"]++; }
    else if (win.length === rb.length) outcomes.allwin++;
    else { feeRounds += pot - Math.floor((pot * 0.95) / win.length) * win.length; outcomes.split++; }
    const s = (stats[r.game] ??= { parties: 0, joueurs: 0, mises: 0, res: {} });
    s.parties++; s.joueurs += rb.length; s.mises += pot; s.res[res.win ?? "égalité"] = (s.res[res.win ?? "égalité"] || 0) + 1;
  }

  // 3. Gains reçus par chaque bot, comparés aux règles
  let checkedPayouts = 0;
  for (const bot of bots) for (const m of bot.results) {
    if (!m.mine) continue;
    checkedPayouts++;
    const stake = STAKES[m.lvl];
    const won = m.res.win !== null && m.mine.choice === m.res.win;
    let exp = 0;
    if (won && m.winners === m.players) exp = stake;                                  // tout le monde gagne : mise rendue, sans commission
    else if (won) exp = Math.floor((m.pot * 0.95) / m.winners);                       // partage à 95 %
    if (m.mine.gain !== exp) fail(`${bot.name}, ${NAMES[m.game]} tour ${m.round} : a reçu ${cr(m.mine.gain)} au lieu de ${cr(exp)}`);
  }

  // 4. Solde de chaque bot : calcul du bot (+ ses tickets gagnants) contre la base
  const drawGain = new Map(); // id du compte -> gains de super cagnotte
  const drawWinners = new Map(); // id du compte -> nombre de tickets gagnants
  for (const d of draws) {
    const res = JSON.parse(d.result);
    if (!d.winners) continue;
    const per = Math.floor(d.amount / d.winners);
    for (const t of tickets) if (t.game === d.game && t.choice === res.win) {
      drawGain.set(t.user_id, (drawGain.get(t.user_id) || 0) + per);
      drawWinners.set(t.user_id, (drawWinners.get(t.user_id) || 0) + 1);
    }
  }
  let unnotified = 0, missedOk = 0;
  for (const bot of bots) {
    const u = users.find((x) => x.name === bot.name);
    const exp = bot.expected + (drawGain.get(u.id) || 0);
    if (u.balance !== exp) fail(`${bot.name} : solde en base ${cr(u.balance)}, attendu ${cr(exp)}`);
    // Chaque gain de super cagnotte doit avoir été annoncé au joueur, une seule fois, avec le bon montant
    const gotTotal = bot.notified.reduce((a, n) => a + n.gain, 0);
    if (drawWinners.has(u.id) && !bot.notified.length) { unnotified++; fail(`${bot.name} a gagné une super cagnotte sans être prévenu`); }
    else if (gotTotal !== (drawGain.get(u.id) || 0)) fail(`${bot.name} : gains annoncés ${cr(gotTotal)}, gains réels ${cr(drawGain.get(u.id) || 0)}`);
    if (bot.offline && bot.notified.some((n) => n.missed)) missedOk++;
  }

  // 5. Mises et tickets tous réglés
  const lastRound = Math.max(...rounds.map((r) => r.round));
  const open = bets.filter((b) => !b.settled && b.round <= lastRound);
  if (open.length) fail(`${open.length} mise(s) d'un tour terminé jamais réglée(s)`);
  const openT = tickets.filter((t) => !t.settled);
  if (openT.length) fail(`${openT.length} ticket(s) de super cagnotte jamais tiré(s)`);

  // 6. Super cagnottes
  for (const d of draws) {
    const res = JSON.parse(d.result);
    const dt = tickets.filter((t) => t.game === d.game);
    const w = res.win === null ? 0 : dt.filter((t) => t.choice === res.win).length;
    if (w !== d.winners) fail(`Super cagnotte ${NAMES[d.game]} : ${d.winners} gagnants annoncés, ${w} recalculés`);
  }

  // 7. Aucun crédit créé ni perdu
  const feeTickets = tickets.length * (TICKET - Math.round(TICKET * 0.95));
  const pending = bets.filter((b) => !b.settled).reduce((a, b) => a + b.stake, 0);
  const before = users.length * START + Object.values(START_JACKPOT).reduce((a, b) => a + b, 0);
  const after = users.reduce((a, u) => a + u.balance, 0) + jackpots.reduce((a, j) => a + j.amount, 0) + pending + feeRounds + feeTickets;
  if (before !== after) fail(`Crédits : ${cr(before)} au départ, ${cr(after)} retrouvés (écart ${cr(after - before)})`);

  return { missedOk, unnotified, winnersCount: drawWinners.size, stats, outcomes, rounds: rounds.length, feeRounds, feeTickets, tickets: tickets.length, draws, checkedPayouts, before, after,
    jackpots, users };
}

// ---------- Déroulement ----------
(async () => {
  console.log(`Jackpool, bots de test : ${BOTS} bots, ${ROUNDS} tours de ${ROUND_MS / 1000} s, base jetable.\n`);
  const srv = await startServer();
  let exitCode = 0;
  try {
    const adminToken = await register("Admin-test"); // le 1er compte est administrateur : il lancera les super cagnottes
    const bots = [];
    for (let i = 1; i <= BOTS; i++) {
      const name = "Bot-" + String(i).padStart(2, "0");
      bots.push(new Bot(name, await register(name)));
    }
    await Promise.all(bots.map((b) => b.connect()));
    const admin = new Bot("Admin-test", adminToken);
    await admin.connect();

    // On démarre au début d'un tour
    const startedRound = Math.floor(Date.now() / ROUND_MS) + 1;
    await sleep(startedRound * ROUND_MS - Date.now() + 50);
    bots.forEach((b) => (b.active = true));
    for (let i = 1; i <= ROUNDS; i++) {
      await sleep(ROUND_MS);
      process.stdout.write(`\rTour ${i}/${ROUNDS} joué…`);
    }
    bots.forEach((b) => (b.active = false));
    await sleep(ROUND_MS + 1500); // dernier tour réglé

    // Quelques bots se déconnectent avant le tirage : ils devront être prévenus en revenant
    const away = bots.slice(0, 10);
    for (const b of away) { b.offline = true; b.ws.close(); }
    // Les autres sont éparpillés : certains loin du jeu de leurs tickets
    for (const b of bots.slice(10)) { b.game = pick(GAMES); b.send({ t: "sub", game: b.game, lvl: 0 }); }
    await sleep(500);

    // Tirage des six super cagnottes
    console.log("\nTirage des super cagnottes…");
    for (const g of GAMES) { admin.send({ t: "drawnow", game: g }); await sleep(400); }
    await sleep(1500);
    // Retour des absents
    await Promise.all(away.map((b) => b.connect()));
    await sleep(1000);

    const r = check(bots, startedRound);

    // ---------- Rapport ----------
    console.log("\n=== Rapport ===");
    console.log(`Parties jouées : ${r.rounds} (toutes tables confondues)`);
    console.log(`  partagées entre gagnants : ${r.outcomes.split}, tout le monde gagne : ${r.outcomes.allwin}, personne ne gagne : ${r.outcomes.nobody}, égalités (Bataille) : ${r.outcomes.tie}`);
    console.log(`Gains vérifiés un par un : ${r.checkedPayouts}`);
    console.log(`Tickets de super cagnotte : ${r.tickets}`);
    console.log(`Commission encaissée : ${cr(r.feeRounds)} sur les parties + ${cr(r.feeTickets)} sur les tickets`);
    console.log("\nPar jeu :");
    for (const g of GAMES) {
      const s = r.stats[g]; if (!s) { console.log(`  ${NAMES[g]} : aucune partie`); continue; }
      const res = Object.entries(s.res).sort().map(([k, v]) => `${k}=${v}`).join(" ");
      console.log(`  ${NAMES[g]} : ${s.parties} parties, ${(s.joueurs / s.parties).toFixed(1)} joueurs en moyenne, ${cr(s.mises)} misés | résultats ${res}`);
    }
    console.log("\nSuper cagnottes tirées :");
    for (const d of r.draws) console.log(`  ${NAMES[d.game]} : ${cr(d.amount)} en jeu, ${d.winners} ticket(s) gagnant(s)`);
    console.log(`  Gagnants prévenus : ${r.winnersCount - r.unnotified} sur ${r.winnersCount} (dont ${r.missedOk} prévenu(s) à leur retour après une absence)`);
    console.log(`\nCrédits au départ : ${cr(r.before)} | retrouvés (soldes + cagnottes + commission) : ${cr(r.after)}`);
    const errs = {}; for (const b of bots) for (const e of b.errors) errs[e] = (errs[e] || 0) + 1;
    if (Object.keys(errs).length) {
      console.log("\nMessages d'erreur reçus par les bots (normaux s'ils jouent trop tard ou sans assez de crédits) :");
      for (const [e, n] of Object.entries(errs)) console.log(`  ${n} × ${e}`);
    }
    if (problems.length) {
      exitCode = 1;
      console.log(`\n❌ ${problems.length} problème(s) trouvé(s) :`);
      for (const p of problems.slice(0, 40)) console.log("  - " + p);
    } else console.log("\n✅ Aucun problème : chaque crédit est compté, chaque gain respecte les règles.");
    for (const b of [...bots, admin]) b.ws.close();
  } catch (e) {
    console.error("\nLe test s'est interrompu :", e.message);
    exitCode = 1;
  } finally {
    srv.kill();
    fs.rmSync(DIR, { recursive: true, force: true });
    process.exit(exitCode);
  }
})();
