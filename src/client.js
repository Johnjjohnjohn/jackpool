// Moteur commun des tables Jackpool : connexion au serveur, mises, résultats, super cagnotte.
// Chaque page définit avant ce fichier un objet G qui décrit son jeu et ses animations.
(function () {
  const $ = (id) => document.getElementById(id);
  window.$ = $;
  const fmt = (c) => (c / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let token = null;
  try { token = localStorage.getItem("jp-token"); } catch (e) {}
  if (!token) { location.replace("index.html"); return; }

  let ws = null, retry = 0, me = null, stakes = [100, 500, 2000], TICKET = 200, FEE = 0.05, offset = 0, roundMs = 60000;
  let lvl = 0, table = null, phase = "bet", last = null, tickets = { counts: {}, mine: {} }, jackpots = {}, nextDraw = 0, drawing = false;
  try { const l = Number(localStorage.getItem("jp-lvl-" + G.key)); if ([0, 1, 2].includes(l)) lvl = l; } catch (e) {}

  // ---------- Connexion ----------
  function connect() {
    status("Connexion à la table…");
    ws = new WebSocket((location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/ws?token=" + encodeURIComponent(token));
    ws.onopen = () => { retry = 0; };
    ws.onmessage = (e) => { try { on(JSON.parse(e.data)); } catch (err) { console.error(err); } };
    ws.onclose = () => { status("Connexion perdue, nouvelle tentative…"); setTimeout(connect, Math.min(8000, 1000 * ++retry)); };
  }
  const sendMsg = (m) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); else status("Pas de connexion pour l'instant, réessaie dans un instant."); };
  function status(t) { const s = $("status"); s.textContent = t; s.hidden = !t; }

  function on(m) {
    if (m.t === "auth" && !m.ok) { try { localStorage.removeItem("jp-token"); } catch (e) {} location.replace("index.html"); return; }
    if (m.t === "hello") {
      status("");
      me = m.me; stakes = m.stakes; TICKET = m.ticket; FEE = m.fee; roundMs = m.roundMs; offset = m.now - Date.now();
      jackpots = m.jackpots; nextDraw = m.nextDraw;
      $("who").textContent = me.name; $("drawNow").hidden = !me.admin;
      buildLevels(); sendMsg({ t: "sub", game: G.key, lvl });
    } else if (m.t === "table") {
      if (m.game !== G.key || m.lvl !== lvl) return;
      table = m; offset = m.now - Date.now();
    } else if (m.t === "tickets") {
      if (m.game !== G.key) return;
      tickets = m; jackpots[G.key] = m.jackpot; nextDraw = m.nextDraw;
    } else if (m.t === "balance") { if (me) me.balance = m.balance; }
    else if (m.t === "jackpots") { jackpots = m.jackpots; nextDraw = m.nextDraw; }
    else if (m.t === "result") { if (m.game === G.key && m.lvl === lvl) onResult(m); }
    else if (m.t === "bigdraw") { if (m.game === G.key) onBigDraw(m); }
    else if (m.t === "error") {
      if (m.req === "ticket" || m.req === "drawnow") { $("jpMsg").textContent = m.message; $("jpMsg").className = "note err"; }
      else { $("msg").className = "msg glass lose"; $("msg").textContent = m.message; }
    }
    render();
  }

  // ---------- Construction de l'interface ----------
  function buildLevels() {
    const box = $("levels"); box.innerHTML = "";
    stakes.forEach((s, i) => {
      const b = document.createElement("button"); b.className = "lvl"; b.id = "lvl" + i; b.textContent = fmt(s).replace(",00", "") + " cr";
      b.onclick = () => {
        if (i === lvl) return;
        if (myBet()) { $("msg").className = "msg glass"; $("msg").textContent = "Ta mise est en jeu à cette table : attends la fin du tour pour changer."; return; }
        lvl = i; table = null; try { localStorage.setItem("jp-lvl-" + G.key, String(i)); } catch (e) {}
        sendMsg({ t: "sub", game: G.key, lvl }); render();
      };
      box.append(b);
    });
  }
  G.OUT.forEach((k) => {
    const b = document.createElement("button"); b.className = "pick num " + G.cls(k); b.id = "pk" + k; b.setAttribute("aria-pressed", "false");
    b.innerHTML = `<strong>${G.btn(k)}</strong><span id="odd${k}">—</span>`; b.onclick = () => pick(k); $("picks").append(b);
    const t = document.createElement("button"); t.className = "pick " + G.cls(k); t.id = "tk" + k;
    t.innerHTML = `<strong>${G.btn(k)}</strong><span id="tkn${k}">0</span>`; t.onclick = () => buyTicket(k); $("tks").append(t);
  });
  const myBet = () => (table && table.bets.find((b) => b.me)) || null;
  function pick(k) {
    if (phase !== "bet" || !table) return;
    const mine = myBet();
    sendMsg({ t: "bet", game: G.key, lvl, choice: mine && mine.choice === k ? null : k });
  }
  function buyTicket(k) { if (!drawing) { $("jpMsg").className = "note"; $("jpMsg").textContent = ""; sendMsg({ t: "ticket", game: G.key, choice: k }); } }
  $("drawNow").onclick = () => sendMsg({ t: "drawnow", game: G.key });
  $("refill").onclick = () => sendMsg({ t: "refill" });
  $("ovClose").onclick = () => { $("ov").hidden = true; };

  // ---------- Affichage ----------
  const secsLeft = () => (table ? Math.max(0, Math.ceil((table.closesAt - (Date.now() + offset)) / 1000)) : 0);
  function render() {
    if (me) { $("bal").textContent = fmt(me.balance); $("refill").hidden = me.balance >= 100; }
    document.querySelectorAll(".lvl").forEach((b, i) => { b.setAttribute("aria-pressed", i === lvl); });
    const stake = stakes[lvl];
    const left = secsLeft(), open = phase === "bet" && table && left > 1;
    $("timer").textContent = phase === "bet" && table ? left : "…";
    const roundS = roundMs / 1000;
    $("arc").style.strokeDashoffset = 201 * (1 - (phase === "bet" && table ? Math.min(1, left / roundS) : 0));
    $("arc").style.stroke = left <= 10 && phase === "bet" ? "var(--face)" : "var(--gold)";
    const ph = $("phase"); ph.className = "phase " + (phase === "flip" ? "flip" : phase === "result" ? "res" : "bet");
    ph.textContent = !table ? "Connexion…" : phase === "bet" ? (left > 1 ? "Mises ouvertes" : "Mises fermées") : phase === "flip" ? G.drawing : "Résultat";
    $("sub").textContent = phase === "bet" ? `Mise : ${fmt(stake).replace(",00", "")} cr` : "Nouveau tour dans un instant";
    const bets = table ? table.bets : [], cnt = (k) => bets.filter((b) => b.choice === k).length, mine = myBet();
    const pot = phase !== "bet" && last ? last.pot : bets.length * stake;
    $("pot").textContent = fmt(pot); $("fee").textContent = fmt(Math.round(pot * FEE)); $("net").textContent = fmt(Math.round(pot * (1 - FEE)));
    const mx = Math.max(1, ...G.OUT.map(cnt));
    $("dist").innerHTML = G.OUT.map((k) => `<div><span>${cnt(k)}</span><i class="${mine && mine.choice === k ? "me" : ""}" style="height:${(cnt(k) / mx) * 40 + 3}px"></i><span class="${G.cls(k)}">${G.tag(k)}</span></div>`).join("");
    G.OUT.forEach((k) => {
      const w = cnt(k) + (mine && mine.choice === k ? 0 : 1), all = bets.length + (mine ? 0 : 1);
      $("odd" + k).textContent = w === all ? "mise rendue" : "gain ≈ " + fmt(Math.floor((all * stake * (1 - FEE)) / w));
      const b = $("pk" + k); b.setAttribute("aria-pressed", !!(mine && mine.choice === k)); b.disabled = !open;
    });
    $("players").innerHTML = bets.map((p) => `<li class="n${p.me ? " me" : ""}">${p.me ? "Toi" : esc(p.name)} · <span class="${G.cls(p.choice)}">${G.tag(p.choice)}</span></li>`).join("") || '<span class="empty">Personne n\'a encore misé à cette table</span>';
    $("hist").innerHTML = (table ? table.history : []).map((h) => `<span class="dot ${G.cls(h)}">${G.tag(h)}</span>`).join("") || '<span class="empty">Aucun tirage encore</span>';
    // super cagnotte
    $("jp").textContent = fmt(jackpots[G.key] || 0);
    if (nextDraw) {
      const ms = nextDraw - (Date.now() + offset), h = Math.max(0, Math.floor(ms / 3600000)), mn = Math.max(0, Math.floor((ms % 3600000) / 60000));
      $("jpTime").textContent = new Date(nextDraw).toLocaleTimeString("fr-FR", { hour: "numeric", timeZone: "Europe/Paris" }).replace(":00", "").replace(" h", "") + " h";
      $("jpNext").textContent = `Prochain tirage dans ${h} h ${String(mn).padStart(2, "0")} min`;
    }
    $("tkPrice").textContent = fmt(TICKET).replace(",00", "");
    G.OUT.forEach((k) => {
      const c = tickets.counts[k] || 0, m = tickets.mine[k] || 0;
      $("tkn" + k).textContent = c + (m ? ` (${m})` : ""); $("tk" + k).disabled = drawing;
    });
    const all = Object.values(tickets.counts).reduce((a, b) => a + b, 0), minet = Object.values(tickets.mine).reduce((a, b) => a + b, 0);
    $("tkMine").textContent = minet; $("tkAll").textContent = all;
    $("drawNow").disabled = drawing;
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  // ---------- Fin de tour ----------
  function onResult(m) {
    last = m; phase = "flip"; render();
    const ms = G.show("main", m.res);
    setTimeout(() => {
      phase = "result";
      const head = G.head(m.res), mine = m.mine;
      let txt, cls = "msg glass";
      if (m.outcome === "empty") txt = `${head} Personne n'a misé à cette table.`;
      else if (m.outcome === "tie" || m.outcome === "nobody") {
        txt = `${head} ${m.outcome === "tie" ? "Égalité :" : "Personne n'avait misé dessus :"} ${fmt(m.toJackpot)} cr partent dans la super cagnotte.`;
        if (mine) cls += " lose";
      } else if (m.outcome === "allwin") { txt = `${head} Tout le monde a gagné : mises rendues, sans commission.`; if (mine) cls += " win"; }
      else if (mine && mine.gain > 0) { txt = `${head} Bravo, tu gagnes ${fmt(mine.gain)} cr !`; cls += " win"; confetti(); }
      else if (mine) { txt = `${head} Perdu cette fois. Chaque gagnant reçoit ${fmt(m.share)} cr.`; cls += " lose"; }
      else txt = `${head} ${m.winners} gagnant${m.winners > 1 ? "s" : ""} à ${fmt(m.share)} cr chacun.`;
      $("msg").className = cls; $("msg").textContent = txt; render();
      setTimeout(() => { phase = "bet"; last = null; G.reset("main"); $("msg").className = "msg glass"; $("msg").textContent = G.prompt; render(); }, 4200);
    }, ms + 300);
  }
  function onBigDraw(m) {
    drawing = true; render();
    $("ov").hidden = false; $("ovClose").hidden = true; $("ovMsg").className = "msg"; $("ovMsg").textContent = G.bigDrawing;
    $("ovPot").textContent = fmt(m.amount); G.reset("big");
    let ms = 0; requestAnimationFrame(() => { ms = G.show("big", m.res, true); });
    setTimeout(() => {
      const head = G.head(m.res); let txt, cls = "msg";
      if (!m.tickets) txt = `${head} Aucun ticket : la super cagnotte est gardée pour le prochain tirage.`;
      else if (!m.winners) { txt = `${head} Aucun ticket gagnant : la super cagnotte est reportée.`; if (m.mine) cls += " lose"; }
      else {
        txt = `${head} ${m.winners} ticket${m.winners > 1 ? "s" : ""} gagnant${m.winners > 1 ? "s" : ""} à ${fmt(m.per)} cr chacun.`;
        if (m.mine && m.mine.gain) { txt += ` Tu remportes ${fmt(m.mine.gain)} cr !`; cls += " win"; confetti(); } else if (m.mine) cls += " lose";
      }
      drawing = false; $("ovMsg").className = cls; $("ovMsg").textContent = txt; $("ovClose").hidden = false; render();
    }, (G.bigMs || 4200));
  }

  // ---------- Confettis ----------
  function confetti() {
    if (reduce) return;
    const c = $("confetti"), x = c.getContext("2d"), W = (c.width = innerWidth), H = (c.height = innerHeight);
    const cols = ["#FFE3A1", "#E2B04A", "#FFFFFF", "#F2784B", "#2BC4A9"];
    const P = Array.from({ length: 140 }, () => ({ x: W / 2, y: H * 0.45, vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 14 - 4, r: Math.random() * 6 + 4, c: cols[Math.floor(Math.random() * 5)], a: Math.random() * 6, va: (Math.random() - 0.5) * 0.4 }));
    let t = 0;
    (function f() {
      x.clearRect(0, 0, W, H);
      P.forEach((p) => { p.vy += 0.35; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.a += p.va; x.save(); x.translate(p.x, p.y); x.rotate(p.a); x.fillStyle = p.c; x.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); x.restore(); });
      if (++t < 110) requestAnimationFrame(f); else x.clearRect(0, 0, W, H);
    })();
  }

  // ---------- Tapis ----------
  function setFelt(f) {
    if (!["vert", "rouge", "bleu"].includes(f)) f = G.felt || "vert";
    const g = document.querySelector(".game"); if (g) g.dataset.felt = f;
    document.querySelectorAll(".felts button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.f === f));
    try { localStorage.setItem("tapis-" + G.key, f); } catch (e) {}
  }
  document.querySelectorAll(".felts button").forEach((b) => (b.onclick = () => setFelt(b.dataset.f)));
  { let f = G.felt || "vert"; try { f = localStorage.getItem("tapis-" + G.key) || f; } catch (e) {} setFelt(f); }

  G.init(); G.reset("main"); $("msg").textContent = G.prompt;
  setInterval(render, 500);
  render(); connect();
})();
