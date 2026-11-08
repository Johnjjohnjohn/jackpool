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

// ---------- Collection : dés, pièces, cartes, gobelets, pailles ----------
// Chaque objet se débloque soit en jouant (niveau ou quêtes terminées), soit en l'achetant avec des crédits.
// Le dernier de chaque famille ne s'achète pas : il se mérite uniquement avec les quêtes.
// price 0 = offert à tous ; price null = pas à vendre.
const CATS = {
  de: "Dés", piece: "Pièces", cartes: "Dos de cartes", gobelets: "Gobelets", pailles: "Pailles",
};
const SKINS = [
  { cat: "de", id: "ivoire", name: "Ivoire", price: 0 },
  { cat: "de", id: "ebene", name: "Ébène", price: 5000, level: 3 },
  { cat: "de", id: "rubis", name: "Rubis", price: 15000, level: 5 },
  { cat: "de", id: "emeraude", name: "Émeraude", price: 15000, quests: 5 },
  { cat: "de", id: "or", name: "Or", price: 50000, level: 10 },
  { cat: "de", id: "diamant", name: "Diamant", price: null, quests: 25 },
  { cat: "piece", id: "p_or", name: "Or", price: 0 },
  { cat: "piece", id: "p_argent", name: "Argent", price: 8000, level: 4 },
  { cat: "piece", id: "p_cuivre", name: "Cuivre", price: 8000, quests: 3 },
  { cat: "piece", id: "p_platine", name: "Platine", price: 30000, level: 8 },
  { cat: "piece", id: "p_obsidienne", name: "Obsidienne", price: null, quests: 15 },
  { cat: "cartes", id: "c_bleu", name: "Bleu royal", price: 0 },
  { cat: "cartes", id: "c_bordeaux", name: "Bordeaux", price: 5000, level: 3 },
  { cat: "cartes", id: "c_vert", name: "Vert anglais", price: 8000, quests: 4 },
  { cat: "cartes", id: "c_noir", name: "Noir et or", price: 50000, level: 12 },
  { cat: "cartes", id: "c_nacre", name: "Nacre", price: null, quests: 20 },
  { cat: "gobelets", id: "g_etain", name: "Étain", price: 0 },
  { cat: "gobelets", id: "g_cuivre", name: "Cuivre", price: 8000, level: 4 },
  { cat: "gobelets", id: "g_bois", name: "Bois verni", price: 10000, quests: 6 },
  { cat: "gobelets", id: "g_or", name: "Or", price: 50000, level: 10 },
  { cat: "gobelets", id: "g_cristal", name: "Cristal", price: null, quests: 30 },
  { cat: "pailles", id: "s_doree", name: "Dorée", price: 0 },
  { cat: "pailles", id: "s_rayee", name: "Rayée rouge", price: 3000, level: 2 },
  { cat: "pailles", id: "s_menthe", name: "Menthe", price: 5000, quests: 3 },
  { cat: "pailles", id: "s_neon", name: "Néon", price: 20000, level: 7 },
  { cat: "pailles", id: "s_arc", name: "Arc-en-ciel", price: null, quests: 12 },
];
const DEFAULT = Object.fromEntries(Object.keys(CATS).map((c) => [c, SKINS.find((s) => s.cat === c && s.price === 0).id]));
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
    for (const s of SKINS) if (s.price !== 0 && !earned(s, Lb, u.quests_done) && earned(s, La, done)) events.push({ t: "skin", id: s.id, name: s.name, cat: s.cat });
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
    const owns = (s) => bought.has(s.id) || earned(s, L, u.quests_done);
    // Objets équipés (le dé est aussi gardé dans users.die_skin, pour les comptes d'avant)
    const equipped = { ...DEFAULT };
    if (SKIN[u.die_skin] && SKIN[u.die_skin].cat === "de") equipped.de = u.die_skin;
    for (const r of await db.query("SELECT cat, item FROM equipped WHERE user_id=$1", [uid])) if (SKIN[r.item] && SKIN[r.item].cat === r.cat) equipped[r.cat] = r.item;
    for (const c in equipped) if (!owns(SKIN[equipped[c]])) equipped[c] = DEFAULT[c];
    return {
      t: "prog", xp: u.xp, level: L, title: titleOf(L), cur: xpFor(L), next: xpFor(L + 1), nextReward: levelReward(L + 1),
      questsDone: u.quests_done, resetAt: nextParisMidnight(),
      quests: dailyQuests(uid, day).map((Q) => ({ id: Q.id, text: Q.text, target: Q.target, reward: Q.reward,
        progress: rows[Q.id] ? rows[Q.id].progress : 0, done: !!(rows[Q.id] && rows[Q.id].done) })),
      skin: equipped.de, equipped, cats: CATS,
      skins: SKINS.map((s) => ({ cat: s.cat, id: s.id, name: s.name, price: s.price, level: s.level || 0, quests: s.quests || 0, owned: owns(s) })),
    };
  }

  async function buySkin(uid, id) {
    const s = SKIN[id];
    if (!s) throw new Error("Cet objet n'existe pas.");
    if (s.price === null) throw new Error(`${s.name} ne s'achète pas : il se gagne en terminant ${s.quests} quêtes.`);
    await db.tx(async (q) => {
      const u = (await q.query("SELECT xp, quests_done FROM users WHERE id=$1", [uid]))[0];
      const has = (await q.query("SELECT skin FROM user_skins WHERE user_id=$1 AND skin=$2", [uid, id])).length;
      if (has || earned(s, levelOf(u.xp), u.quests_done)) throw new Error("Tu l'as déjà dans ta collection.");
      const r = await q.query("UPDATE users SET balance=balance-$1 WHERE id=$2 AND balance>=$1 RETURNING balance", [s.price, uid]);
      if (!r.length) throw new Error("Solde insuffisant pour cet achat.");
      await q.query("INSERT INTO user_skins (user_id,skin,created) VALUES ($1,$2,$3)", [uid, id, Date.now()]);
      await setEquip(q, uid, s);
      await addFee(q, "boutique", "boutique", s.price, s.price);
    });
  }

  async function setEquip(q, uid, s) {
    await q.query("INSERT INTO equipped (user_id,cat,item) VALUES ($1,$2,$3) ON CONFLICT (user_id,cat) DO UPDATE SET item=EXCLUDED.item", [uid, s.cat, s.id]);
    if (s.cat === "de") await q.query("UPDATE users SET die_skin=$1 WHERE id=$2", [s.id, uid]);
  }

  async function equip(uid, id) {
    const st = await state(uid);
    const s = st && st.skins.find((x) => x.id === id);
    if (!s) throw new Error("Cet objet n'existe pas.");
    if (!s.owned) throw new Error("Débloque-le ou achète-le d'abord.");
    await setEquip(db, uid, SKIN[id]);
  }

  return { apply, state, buySkin, equip };
}

module.exports = { CATS, create, XP_PLAY, XP_TICKET, XP_QUEST, xpFor, levelOf, levelReward, QUESTS, SKINS, dailyQuests };
