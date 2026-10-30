# Fabrique les pages des six tables dans public/ à partir des morceaux de src/.
# Lancer : python3 build.py
import os, shutil
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "src"); PARTS = os.path.join(SRC, "parts"); OUT = os.path.join(HERE, "public")
os.makedirs(OUT, exist_ok=True)
part = lambda n: open(os.path.join(PARTS, n), encoding="utf-8").read()

HEAD = """<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{title} · Jackpool</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=Sora:wght@500;600;700&family=DM+Sans:wght@400;500;700&display=swap">
"""
COMMON_CSS = """<style>
:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}
.topnav{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}
.topnav a{color:var(--muted);text-decoration:none;font-size:13px;font-weight:500;padding:6px 12px;border:1px solid var(--edge);border-radius:999px;background:var(--card)}
.topnav a:hover,.topnav a:focus-visible{color:var(--gold-hi);border-color:rgba(226,176,74,.5)}
.age{font-size:12px;color:var(--muted)}
.wallet #who{color:var(--ink);font-weight:700}
.refill{border:1px solid rgba(226,176,74,.5);background:transparent;color:var(--gold-hi);font:600 12px var(--body);padding:4px 10px;border-radius:999px;cursor:pointer}
.status{position:fixed;left:50%;top:calc(10px + env(safe-area-inset-top,0px));transform:translateX(-50%);z-index:40;background:#2a1d0c;color:var(--gold-hi);border:1px solid rgba(226,176,74,.5);padding:8px 16px;border-radius:999px;font-size:13px;font-weight:600;box-shadow:0 8px 20px rgba(0,0,0,.4);max-width:calc(100% - 32px);text-align:center}
.note.err{color:var(--lose)}
.botb{display:inline-block;margin-right:4px;font-size:.95em;filter:saturate(.8)}.n.bot{opacity:.85}
.pick.num.pile strong{color:var(--pile)!important}.pick.num.face strong{color:var(--face)!important}
.dot.pile{background:var(--pile);color:#0A0E19}.dot.face{background:var(--face);color:#0A0E19}
</style>
"""

BODY = """
<div class="status" id="status" hidden></div>
<canvas id="confetti"></canvas>
<div class="wrap">
  <nav class="topnav"><a href="index.html">← Tous les jeux</a><span class="age">18+ · Jouer comporte des risques</span></nav>
  <header>
    <div class="brand">
      <div class="logo">{logo}</div>
      <div><h1>{h1}</h1><div class="tag">Jackpool · crédits virtuels</div></div>
    </div>
    <div class="wallet"><span id="who">…</span> <span class="chip"><span id="bal">0,00</span> cr</span><button class="refill" id="refill" hidden>Recharger</button></div>
  </header>

  <div class="grid">
    <section class="card game" aria-live="polite">
      <div class="scene {scene_cls}" id="scene" aria-hidden="true"></div>
      <div class="bar">
        <div class="seg glass" id="levels" role="group" aria-label="Choisir la mise"></div>
        {felt_seg}
      </div>
      <div class="top glass">
        <div class="ring">
          <svg width="76" height="76" viewBox="0 0 76 76"><circle cx="38" cy="38" r="32" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="6"/>
            <circle id="arc" cx="38" cy="38" r="32" fill="none" stroke="var(--gold)" stroke-width="6" stroke-linecap="round" stroke-dasharray="201" stroke-dashoffset="0" style="transition:stroke-dashoffset .5s linear"/></svg>
          <div class="n" id="timer">…</div>
        </div>
        <div style="display:grid;gap:2px;justify-items:start;text-align:left">
          <span class="phase bet" id="phase">Connexion…</span>
          <span class="sub" id="sub"></span>
        </div>
      </div>
      <div class="stage">{stage_main}</div>
      {printed}
      <div class="picks3" id="picks" style="--cols:{cols}" role="group" aria-label="Faire son choix"></div>
      <div class="msg glass" id="msg"></div>
      <div class="pot glass">
        <div><span class="small">Cagnotte</span><b id="pot">0</b></div>
        <div><span class="small">Commission</span><b id="fee">0</b></div>
        <div><span class="small">À partager</span><b id="net">0</b></div>
      </div>
    </section>

    <aside>
      <div class="card jp" id="jpCard">
        <div class="jphead"><h2>{jpname}</h2><span class="pill" id="jpTime">…</span></div>
        <div class="jpv"><span id="jp">0,00</span> <small>cr</small></div>
        <div class="when" id="jpNext"></div>
        <div class="small">{ticket} · <span id="tkPrice">2</span> cr</div>
        <div class="tk6" id="tks" style="--cols:{cols}"></div>
        <div class="row"><span>Tes tickets : <b id="tkMine">0</b></span><span>Total : <b id="tkAll">0</b></span></div>
        <div class="note" id="jpMsg"></div>
        <button class="ghost" id="drawNow" hidden>Tirer la super cagnotte maintenant (administrateur)</button>
      </div>
      <div class="card">
        <h2>Joueurs de ce tour</h2>
        <div class="dist" id="dist" style="--cols:{cols}"></div>
        <ul id="players"></ul>
      </div>
      <div class="card">
        <h2>Derniers tirages</h2>
        <div class="hist" id="hist"></div>
      </div>
      <div class="card">
        <h2>Comment on joue</h2>
        <div class="rules">{rules}
          <p><b>Tout le monde a gagné ?</b> Chacun récupère sa mise, sans commission.</p>
          <p><b>Personne n'a gagné ?</b> La cagnotte, moins 5 %, part dans la super cagnotte.</p>
          <p><b>Super cagnotte :</b> tirage à 12 h et 21 h (heure de Paris). Chaque ticket, moins 5 %, la fait grossir. Elle est partagée entre les tickets gagnants ; sans gagnant, elle est reportée.</p>
        </div>
      </div>
    </aside>
  </div>
</div>

<div class="ov" id="ov" hidden>
  <div class="ovbox" aria-live="polite">
    <span class="pill">{pill}</span>
    <div class="jpv"><span id="ovPot">0</span> <small>cr</small></div>
    <div class="stage big">{stage_big}</div>
    <div class="msg" id="ovMsg"></div>
    <button class="btn" id="ovClose" hidden>Fermer</button>
  </div>
</div>
"""
FELT_SEG = '<div class="seg glass felts" role="group" aria-label="Couleur du tapis"><button data-f="vert">Vert</button><button data-f="rouge">Rouge</button><button data-f="bleu">Bleu</button></div>'
CARD = lambda i: f'<div class="pcard" id="{i}"><div class="cf back"></div><div class="cf front"></div></div>'
DECK = '<div class="deck"><div class="cf back"></div><div class="cf back"></div><div class="cf back"></div></div>'
COIN = lambda p: f'''<div class="lift" id="{p}Lift"><div class="coin" id="{p}Coin">
        <div class="side"><span class="stars eng">★ ★ ★</span><span class="big eng">1</span><span class="lbl eng">PILE</span></div>
        <div class="side back">SUN<span class="lbl eng">FACE</span></div>
      </div><div class="shadow"></div></div>'''
SUN = open(os.path.join(PARTS, "sun.svg"), encoding="utf-8").read() if os.path.exists(os.path.join(PARTS, "sun.svg")) else ""

CARD_JS = r"""
const SUITS={H:{g:"♥︎",red:1,name:"Cœur"},D:{g:"♦︎",red:1,name:"Carreau"},C:{g:"♣︎",red:0,name:"Trèfle"},S:{g:"♠︎",red:0,name:"Pique"}};
function setFace(card,c){const s=SUITS[c.s],f=card.querySelector(".front");f.classList.toggle("red",!!s.red);
  const center=["V","D","R"].includes(c.r)?`<div class="fig"><b>${c.r}</b><i>${s.g}</i></div>`:c.r==="A"?`<div class="ace">${s.g}</div>`:`<div class="mid"><b>${c.r}</b><i>${s.g}</i></div>`;
  f.innerHTML=`<div class="ci tl"><b>${c.r}</b><i>${s.g}</i></div>${center}<div class="ci br"><b>${c.r}</b><i>${s.g}</i></div>`}
"""

GAMES = [
 dict(file="pile-ou-face.html", key="pof", title="Pile ou Face", logo="P", h1='Pile <span class="o">ou</span> Face', felt="rouge", cols=2,
  css=[], stage_main=COIN("main"), stage_big=COIN("big"), printed="Pile · Face",
  jpname="Super cagnotte", ticket="Ticket pour le pile ou face géant", pill="Tirage de la super cagnotte",
  rules="""<p><b>Une pièce par minute.</b> Pendant le chrono, tout le monde mise le même montant sur pile ou face.</p>
          <p><b>Les gagnants se partagent la cagnotte</b>, moins 5 % de commission.</p>""",
  js="""const G={key:"pof",felt:"rouge",OUT:["P","F"],bigMs:4300,
  prompt:"Choisis pile ou face avant la fin du chrono.",drawing:"La pièce est lancée !",bigDrawing:"La pièce géante est lancée…",
  cls:k=>k==="P"?"pile":k==="F"?"face":"",tag:k=>k,btn:k=>k==="P"?"Pile":"Face",
  rot:{main:0,big:0},init(){},reset(){},
  show(p,r,big){const n=Math.ceil(this.rot[p]/360)*360+(big?8:5)*360+(r.win==="F"?180:0);this.rot[p]=n;
    const lift=$(p+"Lift");lift.classList.remove("toss");void lift.offsetWidth;lift.classList.add("toss");
    $(p+"Coin").style.transform=`rotateY(${n}deg)`;return big?4000:2600},
  head:r=>(r.win==="P"?"Pile":"Face")+" !"};"""),
 dict(file="de-cagnotte.html", key="de", title="Le Dé", logo="6", h1='Le <span class="o">Dé</span>', felt="bleu", cols=3,
  css=["die.css"], stage_main='<div class="lift" id="mainLift"><div class="dicebox"><div class="die" id="mainDie"></div></div><div class="shadow"></div></div>',
  stage_big='<div class="lift" id="bigLift"><div class="dicebox"><div class="die" id="bigDie"></div></div><div class="shadow"></div></div>', printed="Un chiffre de 1 à 6",
  jpname="Super cagnotte du Dé", ticket="Ticket pour le dé géant", pill="Tirage de la super cagnotte du Dé",
  rules="""<p><b>Un dé par minute.</b> Pendant le chrono, tout le monde mise le même montant sur un chiffre de 1 à 6.</p>
          <p><b>Ceux qui ont le bon chiffre se partagent la cagnotte</b>, moins 5 % de commission.</p>""",
  js="""const PIPS={1:[4],2:[2,6],3:[2,4,6],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};
const faceHTML=(n,cls)=>Array.from({length:9},(_,i)=>PIPS[n].includes(i)?`<i class="${cls}${n===1?" as1":""}"></i>`:"<span></span>").join("");
const G={key:"de",felt:"bleu",OUT:["1","2","3","4","5","6"],bigMs:4300,
  prompt:"Choisis un chiffre avant la fin du chrono.",drawing:"Le dé roule !",bigDrawing:"Le dé géant est lancé…",
  cls:k=>"",tag:k=>k,btn:k=>`<span class="mini">${faceHTML(+k,"")}</span>${k}`,
  rot:{main:{x:0,y:0},big:{x:0,y:0}},SHOW:{1:[0,0],2:[0,-90],3:[-90,0],4:[90,0],5:[0,90],6:[0,180]},
  init(){["mainDie","bigDie"].forEach(id=>{$(id).innerHTML=[1,2,3,4,5,6].map(n=>`<div class="f">${faceHTML(n,"pip")}</div>`).join("")})},
  reset(){},
  show(p,r,big){const s=this.rot[p],[tx,ty]=this.SHOW[r.win],t=big?3:2,up=(c,v)=>Math.ceil((c-v)/360)*360+v+t*360;
    s.x=up(s.x,tx);s.y=up(s.y,ty);const lift=$(p+"Lift");lift.classList.remove("toss");void lift.offsetWidth;lift.classList.add("toss");
    $(p+"Die").style.transform=`rotateX(${s.x}deg) rotateY(${s.y}deg)`;return big?4000:2600},
  head:r=>`${r.win} !`};"""),
 dict(file="courte-paille.html", key="paille", title="La Courte Paille", logo="3", h1='La <span class="o">Courte</span> Paille', felt=None, cols=3,
  css=["paille.css"], stage_main='<div class="holder" id="mainHold"></div>', stage_big='<div class="holder" id="bigHold"></div>', printed="",
  jpname="Super cagnotte de la Paille", ticket="Ticket pour la grande courte paille", pill="Tirage de la super cagnotte de la Paille",
  rules="""<p><b>Un tirage par minute.</b> Trois verres, une paille par verre, dont une courte. Pendant le chrono, tout le monde mise le même montant sur la paille 1, 2 ou 3.</p>
          <p><b>Ceux qui ont choisi la courte paille se partagent la cagnotte</b>, moins 5 % de commission.</p>""",
  js="""const G={key:"paille",OUT:["1","2","3"],bigMs:4300,
  prompt:"Choisis une paille avant la fin du chrono.",drawing:"On tire les pailles !",bigDrawing:"On tire les grandes pailles…",
  cls:k=>"",tag:k=>k,btn:k=>"Paille "+k,
  init(){["mainHold","bigHold"].forEach(id=>{$(id).innerHTML=["1","2","3"].map(n=>`<div class="glassw g${n}"><i class="straw s${n}"><span></span></i><div class="cup"></div><div class="slice"></div><b class="gn">${n}</b></div>`).join("")});
    $("scene").innerHTML=plage()},
  reset(p){const h=$(p+"Hold");h.classList.remove("open","shake");h.querySelectorAll(".straw").forEach(s=>s.classList.remove("short","dim","cut"))},
  show(p,r,big){const h=$(p+"Hold"),n=+r.win;this.reset(p);h.querySelectorAll(".straw")[n-1].classList.add("cut");h.classList.add("shake");
    const t=big?3000:1800;setTimeout(()=>{h.classList.remove("shake");h.querySelectorAll(".straw").forEach((s,i)=>s.classList.add(i+1===n?"short":"dim"));h.classList.add("open")},t);return t+800},
  head:r=>`Paille ${r.win} !`};"""),
 dict(file="la-couleur.html", key="couleur", title="La Couleur", logo="&#x2665;&#xFE0E;", h1='La <span class="o">Couleur</span>', felt="vert", cols=2,
  css=[], stage_main=f'<div class="row2">{DECK}{CARD("mainC")}</div>', stage_big=f'<div class="row2">{DECK}{CARD("bigC")}</div>', printed="Cœur · Carreau · Trèfle · Pique",
  jpname="Super cagnotte de la Couleur", ticket="Ticket pour la carte d'or", pill="Tirage de la super cagnotte de la Couleur",
  rules="""<p><b>Une carte par minute.</b> Pendant le chrono, tout le monde mise le même montant sur une couleur : cœur, carreau, trèfle ou pique.</p>
          <p><b>Ceux qui ont la bonne couleur se partagent la cagnotte</b>, moins 5 % de commission.</p>""",
  js=CARD_JS+"""const G={key:"couleur",felt:"vert",OUT:["H","D","C","S"],bigMs:2600,
  prompt:"Choisis une couleur avant la fin du chrono.",drawing:"Tirage de la carte…",bigDrawing:"La carte d'or est tirée…",
  cls:k=>k==="="?"eq":(SUITS[k].red?"rd":"bk"),tag:k=>k==="="?"=":SUITS[k].g,btn:k=>`<span class="sg">${SUITS[k].g}</span> ${SUITS[k].name}`,
  init(){},reset(p){$(p+"C").classList.remove("up","win","deal")},
  show(p,r,big){const c=$(p+"C");c.classList.remove("up","win","deal");void c.offsetWidth;c.classList.add("deal");setFace(c,r.c);
    setTimeout(()=>c.classList.add("up"),big?1100:650);setTimeout(()=>c.classList.add("win"),big?1900:1450);return big?2000:1500},
  head:r=>`${r.c.r} de ${SUITS[r.c.s].name.toLowerCase()} !`};"""),
 dict(file="la-bataille.html", key="bataille", title="La Bataille", logo="A", h1='La <span class="o">Bataille</span>', felt="vert", cols=2,
  css=[], stage_main=f'<div class="duel"><div class="slot">{CARD("mainL")}<span>Gauche</span></div><div class="vs">VS</div><div class="slot">{CARD("mainR")}<span>Droite</span></div></div>',
  stage_big=f'<div class="duel"><div class="slot">{CARD("bigL")}<span>Gauche</span></div><div class="vs">VS</div><div class="slot">{CARD("bigR")}<span>Droite</span></div></div>',
  printed="La plus forte carte l'emporte",
  jpname="Super cagnotte de la Bataille", ticket="Ticket pour la grande bataille", pill="Tirage de la super cagnotte de la Bataille",
  rules="""<p><b>Une bataille par minute.</b> Deux cartes face cachée. Pendant le chrono, tout le monde mise le même montant sur celle de gauche ou celle de droite.</p>
          <p><b>La plus forte carte gagne</b> (l'As est la plus forte) : ceux qui l'ont choisie se partagent la cagnotte, moins 5 % de commission.</p>
          <p><b>Égalité ?</b> La cagnotte, moins 5 %, part dans la super cagnotte. Au tirage de la super cagnotte, une égalité la reporte.</p>""",
  js=CARD_JS+"""const G={key:"bataille",felt:"vert",OUT:["G","D"],bigMs:3200,
  prompt:"Choisis la carte de gauche ou de droite avant la fin du chrono.",drawing:"Les cartes se retournent…",bigDrawing:"La grande bataille commence…",
  cls:k=>k==="="?"eq":"",tag:k=>k,btn:k=>k==="G"?"Gauche":"Droite",
  init(){},reset(p){[p+"L",p+"R"].forEach(id=>$(id).classList.remove("up","win","lose","deal"))},
  show(p,x,big){const L=$(p+"L"),R=$(p+"R"),k=big?1.4:1;
    [L,R].forEach(c=>{c.classList.remove("up","win","lose","deal");void c.offsetWidth;c.classList.add("deal")});
    setFace(L,x.l);setFace(R,x.r);
    setTimeout(()=>L.classList.add("up"),600*k);setTimeout(()=>R.classList.add("up"),1300*k);
    setTimeout(()=>{if(x.win===null){L.classList.add("win");R.classList.add("win")}else{(x.win==="G"?L:R).classList.add("win");(x.win==="G"?R:L).classList.add("lose")}},2100*k);
    return 2200*k},
  head(x){const t=`${x.l.r} contre ${x.r.r}`;return x.win===null?`Égalité (${t}) !`:`${t} : la ${x.win==="G"?"gauche":"droite"} gagne !`}};"""),
 dict(file="les-gobelets.html", key="gobelets", title="Les Gobelets", logo="5", h1='Les <span class="o">Gobelets</span>', felt="rouge", cols=5,
  css=["cups.css"], stage_main='<div class="cups" id="mainCups"></div>', stage_big='<div class="cups" id="bigCups"></div>', printed="Une seule boule d'or",
  jpname="Super cagnotte des Gobelets", ticket="Ticket pour les grands gobelets", pill="Tirage de la super cagnotte des Gobelets",
  rules="""<p><b>Une partie par minute.</b> Cinq gobelets, une seule boule d'or. Pendant le chrono, tout le monde mise le même montant sur un gobelet, de 1 à 5.</p>
          <p><b>Ceux qui ont trouvé la boule d'or se partagent la cagnotte</b>, moins 5 % de commission.</p>""",
  js="""const G={key:"gobelets",felt:"rouge",OUT:["1","2","3","4","5"],bigMs:2900,
  prompt:"Trouve la boule d'or avant la fin du chrono.",drawing:"Les gobelets se mélangent…",bigDrawing:"Les grands gobelets se mélangent…",
  cls:k=>"",tag:k=>k,btn:k=>k,
  init(){["main","big"].forEach(p=>{$(p+"Cups").innerHTML=G.OUT.map(k=>`<div class="cupw"><div class="ball"></div><div class="cup"></div><div class="shadow2"></div><b class="cn">${k}</b></div>`).join("")})},
  reset(p){$(p+"Cups").classList.remove("open","mix")},
  show(p,r,big){const c=$(p+"Cups");c.classList.remove("open","mix");void c.offsetWidth;
    c.querySelectorAll(".ball").forEach((b,i)=>b.classList.toggle("gold",String(i+1)===r.win));
    c.classList.add("mix");const t=big?2000:1500;setTimeout(()=>{c.classList.remove("mix");c.classList.add("open")},t);return t+500},
  head:r=>`La boule d'or était sous le gobelet ${r.win} !`};"""),
]

base = part("base.css").replace("<title>Pile ou Face Cagnotte</title>", "")
for g in GAMES:
    css = base + part("felt.css") + part("cards.css") + "".join(part(c) for c in g["css"]) + COMMON_CSS
    body = BODY
    for k, v in dict(logo=g["logo"], h1=g["h1"], cols=str(g["cols"]), stage_main=g["stage_main"], stage_big=g["stage_big"],
                     printed=f'<div class="printed">{g["printed"]}</div>' if g["printed"] else "", jpname=g["jpname"], ticket=g["ticket"],
                     pill=g["pill"], rules=g["rules"], felt_seg=FELT_SEG if g["felt"] else "", scene_cls="felt" if g["felt"] else "").items():
        body = body.replace("{" + k + "}", v)
    if g["key"] == "pof":
        body = body.replace("SUN", SUN)
    extra = part("plage.js") if g["key"] == "paille" else ""
    html = HEAD.replace("{title}", g["title"]) + css + "</head><body>" + body + "<script>\n" + extra + g["js"] + "\n</script>\n<script src=\"client.js\"></script>\n</body></html>\n"
    open(os.path.join(OUT, g["file"]), "w", encoding="utf-8").write(html)
shutil.copy(os.path.join(SRC, "client.js"), os.path.join(OUT, "client.js"))
shutil.copy(os.path.join(SRC, "index.html"), os.path.join(OUT, "index.html"))
print("Pages fabriquées dans", OUT)
