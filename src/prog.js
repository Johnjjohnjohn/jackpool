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
/* Pièces */
[data-coin]{--c0:#FFF4CC;--c1:#F6CF6A;--c2:#DDA543;--c3:#B07A24;--c4:#7A520F;--ce:#F3CF78;--cd:#946417;--ct:#7d5412}
[data-coin="p_argent"]{--c0:#FFFFFF;--c1:#E6E9EF;--c2:#B9BFCA;--c3:#8A919E;--c4:#4E5562;--ce:#F0F2F6;--cd:#7A818E;--ct:#4a505c}
[data-coin="p_cuivre"]{--c0:#FFE2CC;--c1:#F0A06A;--c2:#C8693A;--c3:#97461F;--c4:#5E260C;--ce:#F5B98F;--cd:#8A3F1A;--ct:#5e260c}
[data-coin="p_platine"]{--c0:#FFFFFF;--c1:#DDE6F0;--c2:#A9B8CC;--c3:#7487A2;--c4:#3E4C63;--ce:#E6EEF8;--cd:#6A7C96;--ct:#2f3b4f}
[data-coin="p_obsidienne"]{--c0:#7a7f98;--c1:#3a3e55;--c2:#1d2034;--c3:#0f1020;--c4:#000;--ce:#6a6f90;--cd:#0b0c17;--ct:#E2C27A}
[data-coin] .side{background:radial-gradient(circle at 34% 26%,var(--c0) 0%,var(--c1) 18%,var(--c2) 44%,var(--c3) 70%,var(--c4) 100%)!important}
[data-coin] .side::before{background:repeating-conic-gradient(var(--ce) 0 1.5deg,var(--cd) 1.5deg 3deg)!important}
[data-coin] .side .eng{color:var(--ct)!important}
[data-coin] .side svg g:last-child{stroke:var(--ct)}
.pv-coin{width:56px;height:56px;border-radius:50%;display:grid;place-items:center;position:relative;font:700 24px Cinzel,Georgia,serif;color:var(--ct);
  background:radial-gradient(circle at 34% 26%,var(--c0) 0%,var(--c1) 18%,var(--c2) 44%,var(--c3) 70%,var(--c4) 100%);box-shadow:0 8px 16px rgba(0,0,0,.45)}
.pv-coin::before{content:"";position:absolute;inset:0;border-radius:50%;background:repeating-conic-gradient(var(--ce) 0 4deg,var(--cd) 4deg 8deg);
  -webkit-mask:radial-gradient(circle,transparent 63%,#000 64%);mask:radial-gradient(circle,transparent 63%,#000 64%)}
/* Dos de cartes */
[data-cards]{--kb:#13214F;--kl:rgba(226,176,74,.3);--kf:#F4EEE0;--kr:rgba(226,176,74,.7)}
[data-cards="c_bordeaux"]{--kb:#5a0f1f;--kl:rgba(255,215,160,.28)}
[data-cards="c_vert"]{--kb:#0f3d28}
[data-cards="c_noir"]{--kb:#0b0c12;--kl:rgba(226,176,74,.55);--kf:#E2B04A;--kr:rgba(255,227,161,.9)}
[data-cards="c_nacre"]{--kb:linear-gradient(135deg,#f6e3f2,#dceff8 45%,#f3ecd8 75%,#e6dcf6);--kl:rgba(130,110,190,.35);--kf:#FFFFFF;--kr:rgba(170,150,220,.8)}
[data-cards] .cf.back,.pv-card{background:radial-gradient(circle,var(--kl),transparent 55%),repeating-linear-gradient(45deg,var(--kl) 0 1px,transparent 1px 8px),repeating-linear-gradient(-45deg,var(--kl) 0 1px,transparent 1px 8px),var(--kb)!important;
  box-shadow:inset 0 0 0 5px var(--kf),inset 0 0 0 7px var(--kr),0 12px 24px rgba(0,0,0,.45)!important}
.pv-card{width:44px;height:62px;border-radius:7px;transform:rotate(-6deg)}
/* Gobelets */
[data-cups]{--u1:#5D6573;--u2:#AEB6C3;--u3:#EEF1F5;--u4:#B9C0CC;--u5:#7E8794;--u6:#4C5360}
[data-cups="g_cuivre"]{--u1:#6e3416;--u2:#c46a3a;--u3:#ffcfa8;--u4:#d88452;--u5:#97461f;--u6:#5e260c}
[data-cups="g_bois"]{--u1:#3d2412;--u2:#7a4a26;--u3:#c08a55;--u4:#8a5a30;--u5:#5e3a1c;--u6:#2e1a0b}
[data-cups="g_or"]{--u1:#7A520F;--u2:#C8902E;--u3:#FFF4CC;--u4:#E2B04A;--u5:#B07A24;--u6:#6b4510}
[data-cups="g_cristal"]{--u1:rgba(150,200,245,.45);--u2:rgba(220,240,255,.6);--u3:rgba(255,255,255,.92);--u4:rgba(205,232,255,.55);--u5:rgba(160,205,245,.45);--u6:rgba(110,165,220,.6)}
[data-cups] .cupw .cup,.pv-cup{background:linear-gradient(90deg,var(--u1) 0%,var(--u2) 18%,var(--u3) 34%,var(--u4) 52%,var(--u5) 78%,var(--u6) 100%)!important}
[data-cups] .cupw .cup::before{background:linear-gradient(90deg,var(--u5),var(--u3) 40%,var(--u5))!important}
[data-cups] .cupw .cup::after{background:linear-gradient(90deg,var(--u6),var(--u4) 35%,var(--u6))!important}
.pv-cup{width:46px;height:58px;clip-path:polygon(20% 0,80% 0,100% 100%,0 100%);filter:drop-shadow(0 8px 8px rgba(0,0,0,.45))}
/* Pailles */
[data-straws]{--wp:repeating-linear-gradient(180deg,transparent 0 52px,rgba(110,72,20,.55) 52px 54px,rgba(255,240,200,.35) 54px 55px,transparent 55px 60px);--wb:linear-gradient(90deg,#A8792F,#E9CB86 35%,#F3DDA4 50%,#D7B06A 70%,#9A6C26)}
[data-straws="s_rayee"]{--wp:repeating-linear-gradient(160deg,#D8263B 0 9px,transparent 9px 18px);--wb:linear-gradient(90deg,#d6d6d6,#fff 45%,#e4e4e4)}
[data-straws="s_menthe"]{--wp:repeating-linear-gradient(180deg,transparent 0 52px,rgba(0,80,60,.35) 52px 54px,transparent 54px 60px);--wb:linear-gradient(90deg,#1e8a69,#8ff0cd 45%,#4cc79e 70%,#17765a)}
[data-straws="s_neon"]{--wp:linear-gradient(transparent,transparent);--wb:linear-gradient(90deg,#8a12c4,#ff9cf8 45%,#d43cff 70%,#7a0fb0)}
[data-straws="s_arc"]{--wp:repeating-linear-gradient(180deg,#ff595e 0 12px,#ffca3a 12px 24px,#8ac926 24px 36px,#1982c4 36px 48px,#6a4c93 48px 60px);--wb:#fff}
[data-straws] .straw span,.pv-straw i{background:var(--wp),linear-gradient(90deg,rgba(255,255,255,0) 0 30%,rgba(255,250,225,.55) 38%,rgba(255,255,255,0) 50%),var(--wb)!important}
[data-straws="s_neon"] .straw:not(.dim):not(.short){filter:drop-shadow(0 0 6px rgba(255,90,250,.8))}
.pv-straw{width:56px;height:62px;position:relative}
.pv-straw i{position:absolute;bottom:0;width:8px;height:60px;border-radius:2px;box-shadow:0 4px 6px rgba(0,0,0,.4)}
.pv-straw i:nth-child(1){left:12px;transform:rotate(-10deg)}.pv-straw i:nth-child(2){left:24px;height:44px}.pv-straw i:nth-child(3){left:36px;transform:rotate(10deg)}
.skin.lock .pv-coin,.skin.lock .pv-card,.skin.lock .pv-cup,.skin.lock .pv-straw{filter:grayscale(.6) brightness(.7)}
.ctabs{display:flex;gap:6px;overflow-x:auto;padding-bottom:2px;scrollbar-width:none}
.ctabs button{flex:none;border:1px solid var(--edge,rgba(255,255,255,.09));background:transparent;color:var(--muted,#9AA3B8);font:600 13px "DM Sans",system-ui,sans-serif;padding:7px 14px;border-radius:999px;cursor:pointer}
.ctabs button[aria-pressed="true"]{background:rgba(226,176,74,.15);border-color:rgba(226,176,74,.6);color:#FFE3A1}
.cnote{font-size:13px;color:var(--muted,#9AA3B8)}
.pglink{font-size:13px;color:#FFE3A1;font-weight:600;text-decoration:none}
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
  const ATTR = { de: "skin", piece: "coin", cartes: "cards", gobelets: "cups", pailles: "straws" };
  const WHERE = { de: "au Dé", piece: "au Pile ou face", cartes: "à la Couleur et à la Bataille", gobelets: "aux Gobelets", pailles: "à la Courte paille" };
  let tab = "de";
  try { const t = localStorage.getItem("jp-coll-tab"); if (ATTR[t]) tab = t; } catch (e) {}
  const preview = (s) => s.cat === "de" ? face(s.id)
    : s.cat === "piece" ? `<div class="pv-coin" data-coin="${s.id}">1</div>`
    : s.cat === "cartes" ? `<div class="pv-card" data-cards="${s.id}"></div>`
    : s.cat === "gobelets" ? `<div class="pv-cup" data-cups="${s.id}"></div>`
    : `<div class="pv-straw" data-straws="${s.id}"><i></i><i></i><i></i></div>`;
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
    const eq = st.equipped || { de: st.skin };
    for (const c in ATTR) if (eq[c]) document.documentElement.dataset[ATTR[c]] = eq[c];
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
    const tabs = $("pgTabs");
    if (tabs && st.cats) tabs.innerHTML = Object.entries(st.cats).map(([c, n]) => `<button data-tab="${c}" aria-pressed="${c === tab}">${esc(n)}</button>`).join("");
    const cn = $("pgCatNote"); if (cn) cn.textContent = `Utilisé ${WHERE[tab]}.`;
    const sk = $("pgSkins");
    if (sk) sk.innerHTML = st.skins.filter((s) => (s.cat || "de") === tab).map((s) => {
      let act;
      const on = s.id === (eq[s.cat || "de"]);
      if (on) act = `<span class="eq">✓ Équipé</span>`;
      else if (s.owned) act = `<button data-eq="${s.id}">Utiliser</button>`;
      else if (s.price) act = `<button class="buy" data-buy="${s.id}">Acheter ${fmt(s.price)} cr</button>`;
      else act = `<span class="locked">🔒 À débloquer</span>`;
      return `<div class="skin${on ? " on" : ""}${s.owned ? "" : " lock"}">${preview(s)}<b>${esc(s.name)}</b><span class="how">${s.owned && s.price !== 0 ? "Dans ta collection" : howTo(s)}</span>${act}</div>`;
    }).join("");
  }

  document.addEventListener("click", (e) => {
    const tb = e.target.closest("[data-tab]");
    if (tb) { tab = tb.dataset.tab; try { localStorage.setItem("jp-coll-tab", tab); } catch (er) {} render(); return; }
    const b = e.target.closest("[data-buy],[data-eq]");
    if (!b || !st) return;
    const msg = $("pgMsg"); if (msg) msg.textContent = "";
    if (b.dataset.buy) {
      const s = st.skins.find((x) => x.id === b.dataset.buy);
      if (!confirm(`Acheter « ${s.name} » (${st.cats[s.cat]}) pour ${fmt(s.price)} cr ?`)) return;
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
        else if (ev.t === "skin") toast(`🎁 Débloqué : <b>${esc(((m.cats || {})[ev.cat] || "") + " " + ev.name)}</b>${$("pgSkins") ? "" : ` · <a href="index.html#collection" style="color:#FFE3A1">le voir</a>`}`);
        else if (ev.t === "bought") toast(`🎁 <b>${esc((m.skins.find((s) => s.id === ev.id) || {}).name || "")}</b> ajouté à ta collection et équipé`);
      }
    },
    error(text) { const msg = $("pgMsg"); if (msg) msg.textContent = text; else toast(esc(text)); },
    tick: render,
  };
  setInterval(() => { const rs = $("pgReset"); if (rs) rs.textContent = untilReset(); }, 30000);
})();
