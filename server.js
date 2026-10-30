// Jackpool : serveur de jeu en cagnotte commune.
// Il lance les parties toutes les minutes, enregistre les mises, paie les gagnants
// et organise les tirages des super cagnottes à 12 h et 21 h (heure de Paris).

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { WebSocketServer } = require("ws");
const db = require("./db");
const { startBots } = require("./bots");

// ---------- Réglages ----------
const PORT = process.env.PORT || 3000;
const ROUND_MS = Number(process.env.ROUND_MS || 60000); // durée d'une partie
const STAKES = [100, 500, 2000]; // mises en centimes de crédit : 1, 5 et 20 cr
const TICKET = 200; // prix d'un ticket de super cagnotte : 2 cr
const FEE = 0.05; // commission de 5 %
const START_BALANCE = 10000; // 100 cr offerts à l'inscription
const DRAW_HOURS = [12, 21]; // tirages des super cagnottes
const TZ = "Europe/Paris";
const START_JACKPOT = { pof: 4275, de: 5840, paille: 3120, couleur: 4750, bataille: 3610, gobelets: 5225 };

// ---------- Les jeux ----------
const SUITS = ["H", "D", "C", "S"];
const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "V", "D", "R", "A"];
const rnd = (n) => crypto.randomInt(n);
const pick = (arr) => arr[rnd(arr.length)];
function deck() {
  const d = [];
  for (const s of SUITS) RANKS.forEach((r, i) => d.push({ r, v: i + 2, s }));
  for (let i = d.length - 1; i > 0; i--) { const j = rnd(i + 1); [d[i], d[j]] = [d[j], d[i]]; }
  return d;
}
const GAMES = {
  pof: { out: ["P", "F"], draw() { return { win: pick(this.out) }; } },
  de: { out: ["1", "2", "3", "4", "5", "6"], draw() { return { win: pick(this.out) }; } },
  paille: { out: ["1", "2", "3"], draw() { return { win: pick(this.out) }; } },
  couleur: { out: SUITS, draw() { const c = deck()[0]; return { win: c.s, c }; } },
  bataille: { out: ["G", "D"], draw() { const d = deck(), l = d[0], r = d[1]; return { l, r, win: l.v > r.v ? "G" : r.v > l.v ? "D" : null }; } },
  gobelets: { out: ["1", "2", "3", "4", "5"], draw() { return { win: pick(this.out) }; } },
};

// ---------- Heure de Paris ----------
function tzOffset(ms) {
  const p = {};
  new Intl.DateTimeFormat("en-US", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
    .formatToParts(new Date(ms)).forEach((x) => (p[x.type] = x.value));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - (ms - (ms % 1000));
}
function parisToUtc(y, m, d, h) { const guess = Date.UTC(y, m, d, h); return guess - tzOffset(guess); }
function nextDrawAfter(t) {
  const local = new Date(t + tzOffset(t));
  const y = local.getUTCFullYear(), m = local.getUTCMonth(), d = local.getUTCDate();
  const c = [];
  for (const dd of [d, d + 1]) for (const h of DRAW_HOURS) c.push(parisToUtc(y, m, dd, h));
  return Math.min(...c.filter((x) => x > t));
}

// ---------- Comptes ----------
const hash = (pass, salt) => crypto.scryptSync(pass, salt, 32).toString("hex");
const newId = () => crypto.randomUUID();
const NAME_RE = /^[\p{L}\p{N} _.-]{2,20}$/u;

async function register(name, pass) {
  name = String(name || "").trim();
  pass = String(pass || "");
  if (!NAME_RE.test(name)) throw new Error("Le pseudo doit faire de 2 à 20 caractères (lettres, chiffres, espace, tiret).");
  if (pass.length < 4) throw new Error("Le mot de passe doit faire au moins 4 caractères.");
  if (/btz/i.test(name)) throw new Error("Ce pseudo est réservé aux bots de test.");
  const key = name.toLowerCase();
  const user = await db.tx(async (q) => {
    if ((await q.query("SELECT id FROM users WHERE name_key=$1", [key])).length) throw new Error("Ce pseudo est déjà pris.");
    const count = (await q.query("SELECT COUNT(*) AS n FROM users WHERE is_bot=0"))[0].n;
    const salt = crypto.randomBytes(16).toString("hex");
    const u = { id: newId(), name, is_admin: Number(count) === 0 ? 1 : 0 }; // le premier compte créé est administrateur
    await q.query("INSERT INTO users (id,name,name_key,pass,balance,is_admin,created) VALUES ($1,$2,$3,$4,$5,$6,$7)",
      [u.id, name, key, salt + ":" + hash(pass, salt), START_BALANCE, u.is_admin, Date.now()]);
    return u;
  });
  return newSession(user.id);
}
async function login(name, pass) {
  const rows = await db.query("SELECT id,pass FROM users WHERE name_key=$1 AND is_bot=0", [String(name || "").trim().toLowerCase()]);
  if (!rows.length) throw new Error("Pseudo ou mot de passe incorrect.");
  const [salt, h] = rows[0].pass.split(":");
  const ok = crypto.timingSafeEqual(Buffer.from(h, "hex"), Buffer.from(hash(String(pass || ""), salt), "hex"));
  if (!ok) throw new Error("Pseudo ou mot de passe incorrect.");
  return newSession(rows[0].id);
}
async function newSession(userId) {
  const token = crypto.randomBytes(24).toString("hex");
  await db.query("INSERT INTO sessions (token,user_id,created) VALUES ($1,$2,$3)", [token, userId, Date.now()]);
  return token;
}
async function userFromToken(token) {
  if (!token) return null;
  const r = await db.query("SELECT u.id,u.name,u.balance,u.is_admin FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=$1", [String(token)]);
  return r[0] || null;
}

// ---------- État en mémoire ----------
const tables = {}; // "jeu:niveau" -> { bets: Map(userId -> {name, choice, stake}), history: [] }
for (const g in GAMES) STAKES.forEach((_, lvl) => (tables[g + ":" + lvl] = { bets: new Map(), history: [] }));
const jackpots = {};
let currentRound = Math.floor(Date.now() / ROUND_MS);
let nextDraw = 0;
const clients = new Set(); // connexions ouvertes

// ---------- Envois ----------
const send = (ws, msg) => { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); };
const toUser = (uid, msg) => { for (const c of clients) if (c.user && c.user.id === uid) send(c, msg); };
const toAll = (msg) => { for (const c of clients) send(c, msg); };
const toTable = (key, fn) => { for (const c of clients) if (c.sub === key) send(c, fn(c)); };

function tableMsg(key, c) {
  const [game, lvl] = key.split(":");
  const t = tables[key];
  return {
    t: "table", game, lvl: Number(lvl), round: currentRound, closesAt: (currentRound + 1) * ROUND_MS, now: Date.now(),
    bets: [...t.bets.entries()].map(([uid, b]) => ({ name: b.name, choice: b.choice, bot: !!b.bot, me: c.user && uid === c.user.id })),
    history: t.history,
  };
}
async function ticketsMsg(game, c) {
  const rows = await db.query("SELECT choice, user_id FROM tickets WHERE game=$1 AND settled=0", [game]);
  const counts = {}, mine = {};
  for (const r of rows) {
    counts[r.choice] = (counts[r.choice] || 0) + 1;
    if (c.user && r.user_id === c.user.id) mine[r.choice] = (mine[r.choice] || 0) + 1;
  }
  return { t: "tickets", game, counts, mine, jackpot: jackpots[game], nextDraw };
}
async function pushTickets(game) {
  for (const c of clients) if (c.sub && c.sub.startsWith(game + ":")) send(c, await ticketsMsg(game, c));
}
async function pushBalance(uid) {
  if (![...clients].some((c) => c.user && c.user.id === uid)) return; // personne de connecté sur ce compte (bots compris)
  const r = await db.query("SELECT balance FROM users WHERE id=$1", [uid]);
  if (r[0]) toUser(uid, { t: "balance", balance: r[0].balance });
}
const pushJackpots = () => toAll({ t: "jackpots", jackpots, nextDraw });

// ---------- Mises ----------
async function placeBet(c, { game, lvl, choice }) {
  const G = GAMES[game];
  lvl = Number(lvl);
  if (!G || !(lvl in STAKES)) throw new Error("Table inconnue.");
  if (choice !== null && !G.out.includes(choice)) throw new Error("Choix invalide.");
  if (Date.now() > (currentRound + 1) * ROUND_MS - 800) throw new Error("Les mises sont fermées pour ce tour.");
  const key = game + ":" + lvl, t = tables[key], uid = c.user.id, round = currentRound, stake = STAKES[lvl];
  const prev = t.bets.get(uid);
  await db.tx(async (q) => {
    if (round !== currentRound || Date.now() > (round + 1) * ROUND_MS - 800) throw new Error("Les mises sont fermées pour ce tour.");
    if (choice === null) {
      if (!prev) return;
      await q.query("DELETE FROM bets WHERE game=$1 AND lvl=$2 AND round=$3 AND user_id=$4 AND settled=0", [game, lvl, round, uid]);
      await q.query("UPDATE users SET balance=balance+$1 WHERE id=$2", [prev.stake, uid]);
    } else if (prev) {
      await q.query("UPDATE bets SET choice=$1 WHERE game=$2 AND lvl=$3 AND round=$4 AND user_id=$5", [choice, game, lvl, round, uid]);
    } else {
      const r = await q.query("UPDATE users SET balance=balance-$1 WHERE id=$2 AND balance>=$1 RETURNING balance", [stake, uid]);
      if (!r.length) throw new Error("Solde insuffisant pour cette mise.");
      await q.query("INSERT INTO bets (id,game,lvl,round,user_id,choice,stake) VALUES ($1,$2,$3,$4,$5,$6,$7)", [newId(), game, lvl, round, uid, choice, stake]);
    }
  });
  if (round !== currentRound) return; // le tour s'est terminé pendant l'enregistrement : le règlement s'en occupe
  if (choice === null) t.bets.delete(uid);
  else t.bets.set(uid, { name: c.user.name, choice, stake, bot: !!c.user.bot });
  toTable(key, (cc) => tableMsg(key, cc));
  await pushBalance(uid);
}

// ---------- Fin d'une partie ----------
async function settleRound(round) {
  for (const key in tables) {
    const [game, lvlS] = key.split(":"), lvl = Number(lvlS), t = tables[key];
    const res = GAMES[game].draw();
    // Lecture des mises et paiements dans une seule transaction : aucune mise ne peut se glisser entre les deux.
    const { bets, winners, outcome, share, toJackpot, pot, gains } = await db.tx(async (q) => {
      const bets = await q.query("SELECT user_id, choice, stake FROM bets WHERE game=$1 AND lvl=$2 AND round=$3 AND settled=0", [game, lvl, round]);
      const pot = bets.reduce((a, b) => a + b.stake, 0);
      const winners = res.win === null ? [] : bets.filter((b) => b.choice === res.win);
      let outcome = "empty", share = 0, toJackpot = 0;
      const gains = new Map();
      if (!bets.length) return { bets, winners, outcome, share, toJackpot, pot, gains };
      if (!winners.length) { outcome = res.win === null ? "tie" : "nobody"; toJackpot = Math.floor(pot * (1 - FEE)); }
      else if (winners.length === bets.length) { outcome = "allwin"; for (const b of bets) gains.set(b.user_id, b.stake); }
      else { outcome = "split"; share = Math.floor((pot * (1 - FEE)) / winners.length); for (const b of winners) gains.set(b.user_id, share); }
      for (const [uid, g] of gains) await q.query("UPDATE users SET balance=balance+$1 WHERE id=$2", [g, uid]);
      if (toJackpot) await q.query("UPDATE jackpots SET amount=amount+$1 WHERE game=$2", [toJackpot, game]);
      await q.query("UPDATE bets SET settled=1 WHERE game=$1 AND lvl=$2 AND round=$3", [game, lvl, round]);
      await q.query("INSERT INTO rounds (game,lvl,round,result,pot,winners,players,created) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
        [game, lvl, round, JSON.stringify(res), pot, winners.length, bets.length, Date.now()]);
      return { bets, winners, outcome, share, toJackpot, pot, gains };
    });
    if (toJackpot) jackpots[game] += toJackpot;
    t.history.unshift(res.win === null ? "=" : res.win);
    t.history.length = Math.min(t.history.length, 12);
    const myBets = new Map(bets.map((b) => [b.user_id, b]));
    toTable(key, (c) => {
      const mine = c.user && myBets.get(c.user.id);
      return { t: "result", game, lvl, round, res, outcome, pot, players: bets.length, winners: winners.length, share, toJackpot,
        mine: mine ? { choice: mine.choice, gain: gains.get(c.user.id) || 0 } : null };
    });
    t.bets.clear();
    for (const uid of myBets.keys()) await pushBalance(uid);
  }
  pushJackpots();
}

// ---------- Super cagnottes ----------
async function buyTicket(c, { game, choice }) {
  const G = GAMES[game];
  if (!G || !G.out.includes(choice)) throw new Error("Choix invalide.");
  const add = Math.round(TICKET * (1 - FEE));
  await db.tx(async (q) => {
    const r = await q.query("UPDATE users SET balance=balance-$1 WHERE id=$2 AND balance>=$1 RETURNING balance", [TICKET, c.user.id]);
    if (!r.length) throw new Error("Solde insuffisant pour un ticket.");
    await q.query("INSERT INTO tickets (id,game,user_id,choice,draw_at) VALUES ($1,$2,$3,$4,$5)", [newId(), game, c.user.id, choice, nextDraw]);
    await q.query("UPDATE jackpots SET amount=amount+$1 WHERE game=$2", [add, game]);
  });
  jackpots[game] += add;
  await pushBalance(c.user.id);
  await pushTickets(game);
  pushJackpots();
}

async function runDraw(game, upTo) {
  const res = GAMES[game].draw();
  const tickets = await db.query("SELECT id, user_id, choice FROM tickets WHERE game=$1 AND settled=0 AND draw_at<=$2", [game, upTo]);
  const win = res.win === null ? [] : tickets.filter((x) => x.choice === res.win);
  const amount = jackpots[game];
  const per = win.length ? Math.floor(amount / win.length) : 0;
  const gains = new Map();
  for (const x of win) gains.set(x.user_id, (gains.get(x.user_id) || 0) + per);
  await db.tx(async (q) => {
    for (const [uid, g] of gains) await q.query("UPDATE users SET balance=balance+$1 WHERE id=$2", [g, uid]);
    if (win.length) await q.query("UPDATE jackpots SET amount=amount-$1 WHERE game=$2", [per * win.length, game]);
    for (const x of tickets) await q.query("UPDATE tickets SET settled=1 WHERE id=$1", [x.id]);
    await q.query("INSERT INTO draws (game,draw_at,result,amount,winners) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (game,draw_at) DO NOTHING",
      [game, upTo, JSON.stringify(res), amount, win.length]);
  });
  if (win.length) jackpots[game] -= per * win.length;
  const mineCount = new Map();
  for (const x of tickets) if (!mineCount.has(x.user_id)) mineCount.set(x.user_id, tickets.filter((y) => y.user_id === x.user_id).length);
  const told = new Set(); // gagnants qui ont vu le tirage en direct
  for (const c of clients) {
    if (!c.sub || !c.sub.startsWith(game + ":")) continue;
    const uid = c.user && c.user.id;
    if (uid && gains.has(uid)) told.add(uid);
    send(c, { t: "bigdraw", game, res, amount, tickets: tickets.length, winners: win.length, per,
      mine: uid && mineCount.has(uid) ? { tickets: mineCount.get(uid), gain: gains.get(uid) || 0 } : null });
  }
  // Les gagnants qui étaient ailleurs sont prévenus aussi : tout de suite s'ils sont connectés,
  // sinon à leur prochaine connexion.
  for (const [uid, gain] of gains) {
    if (told.has(uid)) continue;
    const notice = { t: "biggain", game, gain, tickets: win.filter((x) => x.user_id === uid).length };
    if ([...clients].some((c) => c.user && c.user.id === uid)) toUser(uid, notice);
    else await db.query("INSERT INTO notices (id,user_id,game,gain,tickets,created) VALUES ($1,$2,$3,$4,$5,$6)",
      [newId(), uid, game, gain, notice.tickets, Date.now()]).catch((e) => console.error("Annonce non enregistrée :", e));
  }
  for (const uid of gains.keys()) await pushBalance(uid);
  await pushTickets(game);
}

async function drawAll(at) {
  for (const g in GAMES) await runDraw(g, at);
  await db.query("UPDATE meta SET value=$1 WHERE key='lastDraw'", [String(at)]);
  nextDraw = nextDrawAfter(at);
  pushJackpots();
}

// ---------- Horloge ----------
let busy = false;
async function tick() {
  if (busy) return;
  busy = true;
  try {
    const r = Math.floor(Date.now() / ROUND_MS);
    if (r !== currentRound) {
      const ended = currentRound;
      currentRound = r;
      await settleRound(ended);
      for (const key in tables) toTable(key, (c) => tableMsg(key, c));
    }
    while (nextDraw && Date.now() >= nextDraw) await drawAll(nextDraw);
  } catch (e) {
    console.error("Erreur d'horloge :", e);
  } finally {
    busy = false;
  }
}

// ---------- Démarrage ----------
async function boot() {
  await db.init();
  for (const g in GAMES) {
    await db.query("INSERT INTO jackpots (game, amount) VALUES ($1,$2) ON CONFLICT (game) DO NOTHING", [g, START_JACKPOT[g]]);
  }
  for (const r of await db.query("SELECT game, amount FROM jackpots")) jackpots[r.game] = r.amount;
  // Mises restées en suspens après un redémarrage : on rembourse les tours terminés…
  const stale = await db.query("SELECT id, user_id, stake FROM bets WHERE settled=0 AND round<$1", [currentRound]);
  if (stale.length) {
    await db.tx(async (q) => {
      for (const b of stale) {
        await q.query("UPDATE users SET balance=balance+$1 WHERE id=$2", [b.stake, b.user_id]);
        await q.query("UPDATE bets SET settled=1 WHERE id=$1", [b.id]);
      }
    });
    console.log(`${stale.length} mise(s) remboursée(s) après redémarrage.`);
  }
  // … et on reprend celles du tour en cours.
  for (const b of await db.query("SELECT b.game,b.lvl,b.user_id,b.choice,b.stake,u.name,u.is_bot FROM bets b JOIN users u ON u.id=b.user_id WHERE b.settled=0 AND b.round=$1", [currentRound])) {
    tables[b.game + ":" + b.lvl].bets.set(b.user_id, { name: b.name, choice: b.choice, stake: b.stake, bot: !!b.is_bot });
  }
  const last = await db.query("SELECT value FROM meta WHERE key='lastDraw'");
  if (!last.length) await db.query("INSERT INTO meta (key,value) VALUES ('lastDraw',$1)", [String(Date.now())]);
  nextDraw = nextDrawAfter(last.length ? Number(last[0].value) : Date.now());
  setInterval(tick, 250);
  // Bots de la version de test (seulement si BOTS_PER_TABLE est réglé)
  await startBots({ db, GAMES, STAKES, START_BALANCE, ROUND_MS, placeBet, buyTicket, currentRound: () => currentRound });
  // Ménage : on oublie l'historique détaillé de plus de 3 jours.
  setInterval(() => {
    const old = Date.now() - 3 * 86400000;
    db.query("DELETE FROM rounds WHERE created<$1", [old]).catch(() => {});
    db.query("DELETE FROM bets WHERE settled=1 AND round<$1", [Math.floor(old / ROUND_MS)]).catch(() => {});
  }, 3600000);
}

// ---------- Site web ----------
const PUBLIC = path.join(__dirname, "public");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon" };

function readBody(req) {
  return new Promise((ok, ko) => {
    let s = "";
    req.on("data", (d) => { s += d; if (s.length > 10000) req.destroy(); });
    req.on("end", () => { try { ok(JSON.parse(s || "{}")); } catch (e) { ko(e); } });
  });
}
function json(res, code, obj) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(obj));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (req.method === "POST" && (url.pathname === "/api/register" || url.pathname === "/api/login")) {
    try {
      const body = await readBody(req);
      const token = url.pathname === "/api/register" ? await register(body.name, body.pass) : await login(body.name, body.pass);
      return json(res, 200, { token });
    } catch (e) {
      return json(res, 400, { error: e.message || "Erreur" });
    }
  }
  if (url.pathname === "/health") return json(res, 200, { ok: true, db: db.kind });
  let file = path.normalize(path.join(PUBLIC, url.pathname === "/" ? "index.html" : url.pathname));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }); return res.end("Page introuvable"); }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-cache" });
    res.end(data);
  });
});

// ---------- Temps réel ----------
const wss = new WebSocketServer({ server, path: "/ws" });
wss.on("connection", async (ws, req) => {
  const token = new URL(req.url, "http://x").searchParams.get("token");
  const user = await userFromToken(token).catch(() => null);
  if (!user) { send(ws, { t: "auth", ok: false }); return ws.close(); }
  ws.user = { id: user.id, name: user.name, admin: !!user.is_admin };
  ws.alive = true;
  ws.on("pong", () => (ws.alive = true));
  clients.add(ws);
  send(ws, { t: "hello", me: { name: user.name, balance: user.balance, admin: !!user.is_admin }, stakes: STAKES, ticket: TICKET, fee: FEE,
    roundMs: ROUND_MS, now: Date.now(), jackpots, nextDraw });
  ws.on("close", () => clients.delete(ws));
  ws.on("message", async (raw) => {
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    try {
      if (m.t === "sub") {
        const key = m.game + ":" + Number(m.lvl);
        if (!tables[key]) throw new Error("Table inconnue.");
        ws.sub = key;
        send(ws, tableMsg(key, ws));
        send(ws, await ticketsMsg(m.game, ws));
      } else if (m.t === "bet") await placeBet(ws, m);
      else if (m.t === "ticket") await buyTicket(ws, m);
      else if (m.t === "refill") {
        const r = await db.query("UPDATE users SET balance=$1 WHERE id=$2 AND balance<100 RETURNING balance", [START_BALANCE, ws.user.id]);
        if (!r.length) throw new Error("La recharge n'est possible que sous 1 cr.");
        await pushBalance(ws.user.id);
      } else if (m.t === "drawnow") {
        if (!ws.user.admin) throw new Error("Réservé à l'administrateur.");
        if (!GAMES[m.game]) throw new Error("Jeu inconnu.");
        await runDraw(m.game, Number.MAX_SAFE_INTEGER);
        pushJackpots();
      } else if (m.t === "ping") send(ws, { t: "pong", now: Date.now() });
    } catch (e) {
      send(ws, { t: "error", message: e.message || "Erreur", req: m.t });
    }
  });
  // Gains de super cagnotte remportés pendant son absence
  try {
    // Marquées « vues » et lues en une seule fois : deux onglets ouverts ensemble ne reçoivent pas l'annonce en double.
    const pending = await db.query("UPDATE notices SET seen=1 WHERE user_id=$1 AND seen=0 RETURNING game, gain, tickets, created", [user.id]);
    pending.sort((a, b) => a.created - b.created);
    for (const n of pending) send(ws, { t: "biggain", game: n.game, gain: n.gain, tickets: n.tickets, missed: true });
  } catch (e) { console.error("Annonces en attente :", e); }
});
// Vérifie régulièrement que les connexions sont vivantes.
setInterval(() => {
  for (const ws of clients) {
    if (!ws.alive) { ws.terminate(); clients.delete(ws); continue; }
    ws.alive = false;
    ws.ping();
  }
}, 30000);

boot().then(() => server.listen(PORT, () => console.log(`Jackpool en ligne sur le port ${PORT} (base : ${db.kind})`)))
  .catch((e) => { console.error("Démarrage impossible :", e); process.exit(1); });
