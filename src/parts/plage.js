// ---- décors ----
let seed=7;const rnd=()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646};
const SV=inner=>`<svg viewBox="0 0 400 700" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
function stars(n,maxY,op){let s="";for(let i=0;i<n;i++)s+=`<circle cx="${(rnd()*400).toFixed(1)}" cy="${(rnd()*maxY).toFixed(1)}" r="${(rnd()*1.1+.3).toFixed(2)}" fill="#fff" opacity="${(rnd()*op+.15).toFixed(2)}"/>`;return s}

function plage(){seed=11;
  let refl="";for(let k=0;k<16;k++){const y=468+k*9,w=(130-k*7)*(.7+rnd()*.5);refl+=`<rect x="${200-w/2}" y="${y}" width="${w}" height="${2+k*.15}" rx="1" fill="#FFC680" opacity="${(.75-k*.04).toFixed(2)}"/>`}
  let waves="";for(let k=0;k<26;k++){const y=470+rnd()*110,x=rnd()*400,w=20+rnd()*60;waves+=`<rect x="${x}" y="${y}" width="${w}" height="1.4" fill="#F7A86B" opacity="${(rnd()*.25+.05).toFixed(2)}"/>`}
  const frond=(a,l)=>`<path d="M0 0 C${l*.3} ${-l*.18} ${l*.7} ${-l*.12} ${l} ${l*.2} C${l*.65} ${-l*.02} ${l*.3} ${-l*.04} 0 0Z" transform="rotate(${a})" fill="#07070D"/>`;
  return SV(`<defs>
<linearGradient id="ps" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0F1638"/><stop offset=".38" stop-color="#4A2D63"/><stop offset=".55" stop-color="#B9566A"/><stop offset=".64" stop-color="#F08A55"/><stop offset=".67" stop-color="#FFC37A"/></linearGradient>
<linearGradient id="pm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7A4A6E"/><stop offset=".25" stop-color="#3A2A55"/><stop offset="1" stop-color="#121633"/></linearGradient>
<radialGradient id="pg"><stop offset="0" stop-color="#FFD9A0" stop-opacity=".85"/><stop offset=".4" stop-color="#FF9D60" stop-opacity=".35"/><stop offset="1" stop-color="#FF9D60" stop-opacity="0"/></radialGradient>
<linearGradient id="pd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2A1C2C"/><stop offset="1" stop-color="#0C0A12"/></linearGradient></defs>
<rect width="400" height="700" fill="url(#ps)"/>${stars(40,220,.5)}
<g transform="translate(0 -60)"><circle cx="200" cy="462" r="170" fill="url(#pg)"/><circle cx="200" cy="462" r="44" fill="#FFE2A8"/>
<g fill="#2A1B3A" opacity=".55"><ellipse cx="90" cy="380" rx="70" ry="6"/><ellipse cx="310" cy="350" rx="90" ry="5"/><ellipse cx="250" cy="405" rx="50" ry="4"/></g>
<rect y="464" width="400" height="200" fill="url(#pm)"/>${refl}${waves}
<path d="M318 458 l0 -26 l14 24 z M310 459 h26 l-4 4 h-18z" fill="#140F22"/>
<path d="M0 600 C90 585 170 598 260 592 C320 588 370 596 400 590 V780 H0Z" fill="url(#pd)"/>
<path d="M28 780 C34 640 48 560 86 470" stroke="#07070D" stroke-width="11" fill="none" stroke-linecap="round"/>
<g transform="translate(86 470)">${frond(-170,120)}${frond(-140,130)}${frond(-105,100)}${frond(-60,125)}${frond(-25,135)}${frond(10,110)}${frond(-200,95)}</g></g>`)}

