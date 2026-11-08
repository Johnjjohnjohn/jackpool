// Jackpool : niveaux, quêtes du jour et collection de dés.
// Tout se joue en crédits virtuels. Les bots ne gagnent ni expérience ni quêtes.

const crypto = require("crypto");

// ---------- Expérience et niveaux ----------
const XP_PLAY = 10;   // par partie jouée (gagnée ou perdue, quel que soit le montant de la mise)
const XP_TICKET = 5;  // par ticket de super cagnotte
const XP_QUEST = 50;  // par quête terminée
const xpFor = (L) => 25 * L * (L - 1); // expérience totale pour atteindre le niveau L (1 : 0, 2 : 50, 3 : 150, 5 : 500, 10 : 2 250)
function levelOf(xp) { let L = 1; while (xpFor(L + 1) <= xp) L++; return L; }
const levelReward = (L) => (L % 5 === 0 ? 5000 : 1000); // 10 cr par niveau, 50 cr tous les 5 niveaux
const TITLES = [[1, "Débutant"], [3, "Amateur"], [5, "Habitué"], [10, "Confirmé"], [15, "Expert"], [20, "Maître"], [30, "Légende"]];
const titleOf = (L) => TITLES.filter(([n]) => n <= L).pop()[1];

// ---------- Quêtes du jour ----------
// Chaque joueur reçoit 3 quêtes par jour (une de chaque groupe), tirées au hasard mais identiques toute la journée.
const GAME_LABEL = { pof: "au Pile ou face", de: "au Dé", paille: "à la Courte paille", couleur: "à la Couleur", bataille: "à la Bataille", gobelets: "aux Gobelets" };
const QUESTS = {};
const add = (group, q) => (QUESTS[q.id] = { ...q, group });
add("A", { id: "play5", text: "Joue 5 parties", kind: "play", target: 5, reward: 500 });
add("A", { id: "play12", text: "Joue 12 parties", kind: "play", target: 12, reward: 1000 });
for (const g in GAME_LABEL) add("B", { id: "g_" + g, text: "Joue 3 parties " + GAME_LABEL[g], kind: "play", game: g, target: 3, reward: 600 });
add("C", { id: "win2", text: "Gagne 2 parties", kind: "win", target: 2, reward: 800 });
add("C", { id: "variety3", text: "Joue à 3 jeux différents", kind: "variety", target: 3, reward: 800 });
add("C", { id: "ticket1", text: "Prends un ticket de super cagnotte", kind: "ticket", target: 1, reward: 300 });
const GROUPS = ["A", "B", "C"].map((g) => Object.values(QUESTS).filter((q) => q.group === g));

function dailyQuests(uid, day) {
  const h = crypto.createHash("sha256").update(uid + "|" + day).digest();
  return GROUPS.map((list, i) => list[h[i] % list.length]);
}

// ---------- Collection de dés ----------
// Chaque dé se débloque soit en jouant (niveau ou quêtes terminées), soit en l'achetant avec des crédits.
// Le Diamant ne s'achète pas : il se mérite uniquement avec les quêtes.
const SKINS = [
  { id: "ivoire", name: "Ivoire", price: 0 },
  { id: "ebene", name: "Ébène", price: 5000, level: 3 },
  { id: "rubis", name: "Rubis", price: 15000, level: 5 },
  { id: "emeraude", name: "Émeraude", price: 15000, quests: 5 },
  { id: "or", name: "Or", price: 50000, level: 10 },
  { id: "diamant", name: "Diamant", price: null, quests: 25 },
];
const SKIN = Object.fromEntries(SKINS.map((s) => [s.id, s]));
const earned = (s, L, done) => s.price === 0 || (s.level && L >= s.level) || (s.quests && done >= s.quests);

function create({ db, parisDay, nextParisMidnight, addFee }) {
  // Enregistre ce que le joueur vient de faire et distribue les récompenses.
  // À appeler à l'intérieur d'une transaction (q). evs : [{ k: "play", game, win }, { k: "ticket", game }]
  async function apply(q, uid, evs) {
    const day = parisDay();
    const u = (await q.query("SELECT xp, quests_done FROM users WHERE id=$1", [uid]))[0];
    if (!u) return null;
    const before = u.xp, rows = {};
    for (const r of await q.query("SELECT qid, progress, extra, done FROM quest_progress WHERE user_id=$1 AND day=$2", [uid, day])) rows[r.qid] = r;
    let xp = u.xp, done = u.quests_done, credits = 0;
    const events = [], rewards = [], touched = new Set();
    for (const ev of evs) {
      xp += ev.k === "play" ? XP_PLAY : XP_TICKET;
      for (const Q of dailyQuests(uid, day)) {
        const r = (rows[Q.id] ??= { qid: Q.id, progress: 0, extra: "", done: 0, fresh: true });
        if (r.done) continue;
        let p = r.progress;
        if (Q.kind === "play" && ev.k === "play" && (!Q.game || Q.game === ev.game)) p++;
        else if (Q.kind === "win" && ev.k === "play" && ev.win) p++;
        else if (Q.kind === "ticket" && ev.k === "ticket") p++;
        else if (Q.kind === "variety" && ev.k === "play") {
          const set = new Set(r.extra ? r.extra.split(",") : []); set.add(ev.game);
          r.extra = [...set].join(","); p = set.size;
        }
        if (p === r.progress && Q.kind !== "variety") continue;
        r.progress = Math.min(p, Q.target); touched.add(Q.id);
        if (r.progress >= Q.target) {
          r.done = 1; done++; xp += XP_QUEST; credits += Q.reward;
          rewards.push(["quête " + Q.id, Q.reward]);
          events.push({ t: "quest", text: Q.text, reward: Q.reward });
        }
      }
    }
    for (let L = levelOf(before) + 1; L <= levelOf(xp); L++) {
      credits += levelReward(L);
      rewards.push(["niveau " + L, levelReward(L)]);
      events.push({ t: "level", level: L, title: titleOf(L), reward: levelReward(L) });
    }
    // Dés débloqués en jouant
    const Lb = levelOf(before), La = levelOf(xp);
    for (const s of SKINS) if (s.price !== 0 && !earned(s, Lb, u.quests_done) && earned(s, La, done)) events.push({ t: "skin", id: s.id, name: s.name });
    for (const id of touched) {
      const r = rows[id];
      await q.query(`INSERT INTO quest_progress (user_id,day,qid,progress,extra,done) VALUES ($1,$2,$3,$4,$5,$6)
        ON CONFLICT (user_id,day,qid) DO UPDATE SET progress=EXCLUDED.progress, extra=EXCLUDED.extra, done=EXCLUDED.done`,
        [uid, day, id, r.progress, r.extra || "", r.done]);
    }
    await q.query("UPDATE users SET xp=$1, quests_done=$2, balance=balance+$3 WHERE id=$4", [xp, done, credits, uid]);
    for (const [kind, amount] of rewards)
      await q.query("INSERT INTO rewards (id,user_id,kind,amount,created) VALUES ($1,$2,$3,$4,$5)", [crypto.randomUUID(), uid, kind, amount, Date.now()]);
    return { credits, events };
  }

  // Tout ce que la page doit afficher pour ce joueur
  async function state(uid) {
    const day = parisDay();
    const u = (await db.query("SELECT xp, quests_done, die_skin FROM users WHERE id=$1", [uid]))[0];
    if (!u) return null;
    const rows = {};
    for (const r of await db.query("SELECT qid, progress, done FROM quest_progress WHERE user_id=$1 AND day=$2", [uid, day])) rows[r.qid] = r;
    const bought = new Set((await db.query("SELECT skin FROM user_skins WHERE user_id=$1", [uid])).map((r) => r.skin));
    const L = levelOf(u.xp);
    return {
      t: "prog", xp: u.xp, level: L, title: titleOf(L), cur: xpFor(L), next: xpFor(L + 1), nextReward: levelReward(L + 1),
      questsDone: u.quests_done, resetAt: nextParisMidnight(),
      quests: dailyQuests(uid, day).map((Q) => ({ id: Q.id, text: Q.text, target: Q.target, reward: Q.reward,
        progress: rows[Q.id] ? rows[Q.id].progress : 0, done: !!(rows[Q.id] && rows[Q.id].done) })),
      skin: SKIN[u.die_skin] ? u.die_skin : "ivoire",
      skins: SKINS.map((s) => ({ id: s.id, name: s.name, price: s.price, level: s.level || 0, quests: s.quests || 0,
        owned: bought.has(s.id) || earned(s, L, u.quests_done) })),
    };
  }

  async function buySkin(uid, id) {
    const s = SKIN[id];
    if (!s) throw new Error("Ce dé n'existe pas.");
    if (s.price === null) throw new Error(`Le dé ${s.name} ne s'achète pas : il se gagne en terminant ${s.quests} quêtes.`);
    await db.tx(async (q) => {
      const u = (await q.query("SELECT xp, quests_done FROM users WHERE id=$1", [uid]))[0];
      const has = (await q.query("SELECT skin FROM user_skins WHERE user_id=$1 AND skin=$2", [uid, id])).length;
      if (has || earned(s, levelOf(u.xp), u.quests_done)) throw new Error("Tu as déjà ce dé.");
      const r = await q.query("UPDATE users SET balance=balance-$1, die_skin=$3 WHERE id=$2 AND balance>=$1 RETURNING balance", [s.price, uid, id]);
      if (!r.length) throw new Error("Solde insuffisant pour ce dé.");
      await q.query("INSERT INTO user_skins (user_id,skin,created) VALUES ($1,$2,$3)", [uid, id, Date.now()]);
      await addFee(q, "boutique", "boutique", s.price, s.price);
    });
  }

  async function equip(uid, id) {
    const st = await state(uid);
    const s = st && st.skins.find((x) => x.id === id);
    if (!s) throw new Error("Ce dé n'existe pas.");
    if (!s.owned) throw new Error("Débloque ou achète ce dé d'abord.");
    await db.query("UPDATE users SET die_skin=$1 WHERE id=$2", [id, uid]);
  }

  return { apply, state, buySkin, equip };
}

module.exports = { create, XP_PLAY, XP_TICKET, XP_QUEST, xpFor, levelOf, levelReward, QUESTS, SKINS, dailyQuests };
