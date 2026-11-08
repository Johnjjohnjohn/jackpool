// Jackpool : affichage du niveau, des quêtes du jour et de la collection de dés.
// Utilisé par l'accueil et par les six tables. Chaque page appelle JPProg.init(send) puis JPProg.update(msg).
(function () {
  const $ = (id) => document.getElementById(id);
  const fmt = (c) => (c / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(",00", "");
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  let send = () => {}, st = null;

  // ---------- Styles (couleurs des dés et cartes de progression) ----------
  const css = `
[data-skin]{--d1:#FFFDF6;--d2:#F1EBDD;--d3:#D9D0BC;--p1:#3a3f52;--p2:#11141f;--a1:#E8475B;--a2:#9C0F24;--ph:rgba(255,255,255,.7)}
[data-skin="ebene"]{--d1:#555b72;--d2:#262a3c;--d3:#0d0f18;--p1:#FFF6DA;--p2:#C9B98A;--a1:#FF6B6B;--a2:#B3142A;--ph:rgba(0,0,0,.5)}
[data-skin="rubis"]{--d1:#FF9AA8;--d2:#C21F3A;--d3:#6E0A1C;--p1:#FFF7E8;--p2:#E9D9B5;--a1:#FFE3A1;--a2:#C8902E;--ph:rgba(0,0,0,.35)}
[data-skin="emeraude"]{--d1:#9AF2CC;--d2:#1C9E68;--d3:#0A4A31;--p1:#FFFDF4;--p2:#E3DCC2;--a1:#FFE3A1;--a2:#C8902E;--ph:rgba(0,0,0,.35)}
[data-skin="or"]{--d1:#FFF4CC;--d2:#E2B04A;--d3:#8F6118;--p1:#6b4510;--p2:#2e1d02;--a1:#B8162B;--a2:#5e0614;--ph:rgba(255,240,200,.6)}
[data-skin="diamant"]{--d1:#FFFFFF;--d2:#D6ECFF;--d3:#86BDEB;--p1:#2a5a8f;--p2:#0a1d33;--a1:#E8475B;--a2:#9C0F24;--ph:rgba(255,255,255,.9)}
.die .f{background:radial-gradient(circle at 30% 25%,var(--d1),var(--d2) 55%,var(--d3))!important}
[data-skin="diamant"] .die .f{background:linear-gradient(135deg,rgba(255,255,255,.9) 0 18%,transparent 19% 40%,rgba(255,255,255,.5) 41% 46%,transparent 47%),radial-gradient(circle at 30% 25%,var(--d1),var(--d2) 55%,var(--d3))!important}
.die .pip{background:radial-gradient(circle at 40% 35%,var(--p1),var(--p2) 70%)!important;box-shadow:0 1px 0 var(--ph)!important}
.die .pip.as1{background:radial-gradient(circle at 40% 35%,var(--a1),var(--a2) 70%)!important}
.lvlchip[hidden]{display:none!important}
.lvlchip{display:inline-flex;align-items:center;gap:4px;border:1px solid rgba(226,176,74,.5);color:#FFE3A1;font:700 12px "DM Sans",system-ui,sans-serif;padding:3px 10px;border-radius:999px;text-decoration:none;white-space:nowrap}
.pg{display:grid;gap:12px}
.pg .lvrow{display:flex;align-items:center;gap:14px}
.pg .badge{flex:none;width:58px;height:58px;border-radius:50%;display:grid;place-items:center;font:700 22px "Sora",system-ui,sans-serif;color:#3d2805;
  background:radial-gradient(circle at 35% 30%,#FFE3A1,#E2B04A 50%,#8F6118);box-shadow:0 0 0 3px rgba(255,227,161,.18),0 6px 16px rgba(226,176,74,.3)}
.pg .lvtxt{display:grid;gap:2px;min-width:0;flex:1}
.pg .lvtxt b{font:600 17px "Sora",system-ui,sans-serif;color:var(--ink,#EEF0F6)}
.pg .muted{color:var(--muted,#9AA3B8);font-size:13px}
.pg .bar{height:8px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden}
.pg .bar i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#E2B04A,#FFE3A1);transition:width .6s}
.pg .qhead{display:flex;justify-content:space-between;align-items:baseline;gap:8px}
.pg .qhead h2,.pg .qhead h3{margin:0}
.pg ul{list-style:none;margin:0;padding:0;display:grid;gap:10px}
.pg li{display:grid;gap:6px}
.pg .qt{display:flex;justify-content:space-between;gap:10px;font-size:14px}
.pg .qt span:first-child{color:var(--ink,#EEF0F6)}
.pg .qt .rw{color:#FFE3A1;font-weight:700;white-space:nowrap;font-variant-numeric:tabular-nums}
.pg li.done .qt span:first-child{color:var(--muted,#9AA3B8);text-decoration:line-through}
.pg li.done .bar i{background:linear-gradient(90deg,#16927e,#36d3b7)}
.skins{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,150px),1fr));gap:12px}
.skin{display:grid;justify-items:center;gap:8px;padding:14px 10px;border-radius:16px;border:1px solid var(--edge,rgba(255,255,255,.09));background:rgba(255,255,255,.03);text-align:center}
.skin.on{border-color:rgba(226,176,74,.7);background:rgba(226,176,74,.08)}
.skin b{font:600 15px "Sora",system-ui,sans-serif;color:var(--ink,#EEF0F6)}
.skin .how{font-size:12px;color:var(--muted,#9AA3B8);min-height:2.6em;line-height:1.3}
.skin button{border:1px solid rgba(226,176,74,.55);background:transparent;color:#FFE3A1;font:700 13px "DM Sans",system-ui,sans-serif;padding:6px 14px;border-radius:999px;cursor:pointer}
.skin button.buy{background:linear-gradient(180deg,#FFE3A1,#E2B04A);color:#3d2805;border:0}
.skin button:disabled{opacity:.5;cursor:default}
.skin .eq{font:700 12px "DM Sans",system-ui,sans-serif;color:#36d3b7;padding:6px 0}
.skin .locked{font-size:12px;color:var(--muted,#9AA3B8);padding:6px 0}
.dface{width:56px;height:56px;border-radius:12px;display:grid;grid-template:repeat(3,1fr)/repeat(3,1fr);padding:9px;gap:2px;
  background:radial-gradient(circle at 30% 25%,var(--d1),var(--d2) 55%,var(--d3));box-shadow:0 8px 16px rgba(0,0,0,.45),inset 0 -4px 8px rgba(0,0,0,.18)}
[data-skin="diamant"].dface{background:linear-gradient(135deg,rgba(255,255,255,.9) 0 18%,transparent 19% 40%,rgba(255,255,255,.5) 41% 46%,transparent 47%),radial-gradient(circle at 30% 25%,var(--d1),var(--d2) 55%,var(--d3))}
.dface i{width:80%;height:80%;margin:auto;border-radius:50%;background:radial-gradient(circle at 40% 35%,var(--p1),var(--p2) 70%)}
.dface i.a{background:radial-gradient(circle at 40% 35%,var(--a1),var(--a2) 70%)}
.skin.lock .dface{filter:grayscale(.6) brightness(.7)}
.pgmsg{font-size:13px;min-height:1.2em;color:#FF6E5E}
.ptoast{display:grid;grid-template-columns:1fr auto;gap:4px 12px;align-items:center;background:linear-gradient(180deg,#3a2a0e,#241906);color:#FFE3A1;border:1px solid rgba(226,176,74,.7);border-radius:16px;padding:12px 14px;box-shadow:0 12px 30px rgba(0,0,0,.5);font:500 14px/1.35 "DM Sans",system-ui,sans-serif}
.ptoast b{color:#fff}.ptoast button{border:0;background:transparent;color:#FFE3A1;font-size:22px;line-height:1;cursor:pointer;padding:4px}
.ptoastbox{position:fixed;left:50%;top:calc(56px + env(safe-area-inset-top,0px));transform:translateX(-50%);z-index:61;display:grid;gap:8px;width:min(420px,calc(100% - 32px))}
`;
  const style = document.createElement("style"); style.textContent = css; document.head.append(style);

  const FIVE = [0, 2, 4, 6, 8];
  const face = (id) => `<div class="dface" data-skin="${id}">${Array.from({ length: 9 }, (_, i) => (FIVE.includes(i) ? `<i${i === 4 ? ' class="a"' : ""}></i>` : "<span></span>")).join("")}</div>`;

  function howTo(s) {
    const ways = [];
    if (s.level) ways.push(`niveau ${s.level}`);
    if (s.quests) ways.push(`${s.quests} quêtes terminées`);
    if (s.price === 0) return "Offert à tous";
    if (s.price === null) return `Uniquement par les quêtes : ${ways.join(" ou ")}`;
    return `${ways.length ? "Gratuit au " + ways.join(" ou avec ") + ", ou " : ""}${fmt(s.price)} cr`;
  }

  function untilReset() {
    if (!st) return "";
    const ms = Math.max(0, st.resetAt - Date.now()), h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
    return `Nouvelles quêtes dans ${h} h ${String(m).padStart(2, "0")}`;
  }

  function render() {
    if (!st) return;
    document.documentElement.dataset.skin = st.skin;
    const chip = $("lvlChip");
    if (chip) { chip.hidden = false; chip.textContent = `★ Niv. ${st.level}`; chip.title = `${st.title} · ${st.xp} XP`; }
    const pct = Math.max(0, Math.min(100, ((st.xp - st.cur) / (st.next - st.cur)) * 100));
    const lv = $("pgLevel");
    if (lv) lv.innerHTML = `<div class="lvrow"><div class="badge">${st.level}</div><div class="lvtxt"><b>${esc(st.title)}</b>
      <span class="muted">${st.xp - st.cur} / ${st.next - st.cur} XP vers le niveau ${st.level + 1} · +${fmt(st.nextReward)} cr à la clé</span></div></div>
      <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct)}"><i style="width:${pct}%"></i></div>
      <span class="muted">+10 XP par partie, +5 XP par ticket, +50 XP par quête. ${st.questsDone} quête${st.questsDone > 1 ? "s" : ""} terminée${st.questsDone > 1 ? "s" : ""} au total.</span>`;
    const qs = $("pgQuests");
    if (qs) qs.innerHTML = st.quests.map((q) => `<li class="${q.done ? "done" : ""}"><div class="qt"><span>${q.done ? "✓ " : ""}${esc(q.text)}</span>
      <span class="rw">${q.done ? "Gagné" : q.progress + "/" + q.target} · +${fmt(q.reward)} cr</span></div>
      <div class="bar"><i style="width:${(q.progress / q.target) * 100}%"></i></div></li>`).join("");
    const rs = $("pgReset"); if (rs) rs.textContent = untilReset();
    const sk = $("pgSkins");
    if (sk) sk.innerHTML = st.skins.map((s) => {
      let act;
      if (s.id === st.skin) act = `<span class="eq">✓ Équipé</span>`;
      else if (s.owned) act = `<button data-eq="${s.id}">Utiliser</button>`;
      else if (s.price) act = `<button class="buy" data-buy="${s.id}">Acheter ${fmt(s.price)} cr</button>`;
      else act = `<span class="locked">🔒 À débloquer</span>`;
      return `<div class="skin${s.id === st.skin ? " on" : ""}${s.owned ? "" : " lock"}">${face(s.id)}<b>${esc(s.name)}</b><span class="how">${s.owned && s.price !== 0 ? "Dans ta collection" : howTo(s)}</span>${act}</div>`;
    }).join("");
  }

  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-buy],[data-eq]");
    if (!b || !st) return;
    const msg = $("pgMsg"); if (msg) msg.textContent = "";
    if (b.dataset.buy) {
      const s = st.skins.find((x) => x.id === b.dataset.buy);
      if (!confirm(`Acheter le dé ${s.name} pour ${fmt(s.price)} cr ?`)) return;
      send({ t: "buyskin", id: s.id });
    } else send({ t: "equip", id: b.dataset.eq });
  });

  function toast(html) {
    let box = $("ptoastBox");
    if (!box) { box = document.createElement("div"); box.id = "ptoastBox"; box.className = "ptoastbox"; box.setAttribute("role", "status"); document.body.append(box); }
    const d = document.createElement("div"); d.className = "ptoast";
    d.innerHTML = `<span>${html}</span><button aria-label="Fermer">×</button>`;
    d.querySelector("button").onclick = () => d.remove();
    box.append(d); setTimeout(() => d.remove(), 7000);
  }

  window.JPProg = {
    init(fn) { send = fn; },
    update(m) {
      if (!m) return;
      st = m; render();
      for (const ev of m.events || []) {
        if (ev.t === "quest") toast(`✅ Quête terminée : <b>${esc(ev.text)}</b> · +${fmt(ev.reward)} cr`);
        else if (ev.t === "level") toast(`⭐ Niveau <b>${ev.level}</b> atteint (${esc(ev.title)}) · +${fmt(ev.reward)} cr`);
        else if (ev.t === "skin") toast(`🎲 Nouveau dé débloqué : <b>${esc(ev.name)}</b>${$("pgSkins") ? "" : ` · <a href="index.html#collection" style="color:#FFE3A1">le voir</a>`}`);
        else if (ev.t === "bought") toast(`🎲 Dé <b>${esc((m.skins.find((s) => s.id === ev.id) || {}).name || "")}</b> ajouté à ta collection et équipé`);
      }
    },
    error(text) { const msg = $("pgMsg"); if (msg) msg.textContent = text; else toast(esc(text)); },
    tick: render,
  };
  setInterval(() => { const rs = $("pgReset"); if (rs) rs.textContent = untilReset(); }, 30000);
})();
