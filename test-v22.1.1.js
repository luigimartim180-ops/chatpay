"use strict";
let passed=0;let failed=0;
function assert(label,cond,detail){if(cond){console.log("  PASS: "+label);passed++;}else{console.error("  FAIL: "+label+(detail?" -- "+detail:""));failed++;}}
const NEG=["nao","nao","sem","nunca","jamais"];
function normT(t){return String(t||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();}
function matchPhrase(text,words,phrase){
  const norm=normT(phrase);if(!norm)return false;
  const esc=norm.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  const re=new RegExp("(?:^|\\s|[^\\p{L}])"+esc+"(?=$|\\s|[^\\p{L}])","u");
  if(!re.test(text))return false;
  const idx=text.indexOf(norm);
  if(idx>0){const bef=text.slice(0,idx).trim().split(/\s+/).slice(-4);if(bef.some(w=>NEG.includes(w)))return false;}
  return true;
}
const OPTOUT=/pare|nao me responda|me deixa|opt-out|saia|para de me mandar|nao quero mais|cancela|descadastrar|remover/i;
const TOXIC=/golpe|ladr[ãa]o|merda|bosta|fdp|filho da puta|puta(?!tivo|tiva)|vagabundo|idiota|estelionato|fraude/i;
const MODES={LS:"live_selling",DM:"dm_conversation",GC:"group_chat",CB:"comment_to_buy",QA:"qa_session"};
function detectMode(url,meta,ch){const u=String(url||"").toLowerCase();const m=meta||{};const c=String(ch||"").toLowerCase();if(m.is_live)return MODES.LS;if(m.is_comment)return MODES.CB;if(m.is_qa||m.host_question)return MODES.QA;if(m.is_group)return MODES.GC;if(m.is_dm)return MODES.DM;if(u.includes("/live")||u.includes("/stream")||c==="live"||c==="youtube_live")return MODES.LS;if(m.type==="comment"||c==="comment")return MODES.CB;if(c.includes("group"))return MODES.GC;if(u.includes("/direct")||u.includes("/dm")||c.includes("dm")||c.includes("direct")||c==="whatsapp"||c==="instagram")return MODES.DM;return MODES.DM;}
function simLive(max){let cnt=0;const cd=new Set();return function(uid){cnt++;if(cnt>max)return{s:"ignored",r:"rate"};if(cd.has(uid))return{s:"ignored",r:"cooldown"};cd.add(uid);return{s:"replied"};};}
function simIp(max){const ip={};return function(a){ip[a]=(ip[a]||0)+1;return ip[a]<=max;};}
function round(l,s,r){return{la:"mais de "+Math.floor(l/10)*10,sa:"mais de "+Math.floor(s/5)*5,ga:"mais de R$ "+Math.floor(r/10000)*100};}

console.log("\n=== TEST 1: Live Rate-Limiter ===");
{const h=simLive(5);const res=[];for(let i=0;i<10;i++)res.push(h("A"));
assert("<=5 replies/min",res.filter(x=>x.s==="replied").length<=5,"got "+res.filter(x=>x.s==="replied").length);
assert(">=4 rate-limited",res.filter(x=>x.r==="rate").length>=4);
const h2=simLive(5);h2("X");const r2=h2("X");assert("same user cooldown",r2.r==="cooldown");assert("diff user ok",h2("Y").s==="replied");}

console.log("\n=== TEST 2: Whole-Word ===");
{const t1=normT("capitulo 1 do curso");assert('"1" matches',matchPhrase(t1,t1.split(/\s+/),"1"));assert('"cap" no match',!matchPhrase(t1,t1.split(/\s+/),"cap"));const t3=normT("europeu viajante");assert('"eu" no match in europeu',!matchPhrase(t3,t3.split(/\s+/),"eu"));const t2=normT("eu quero sim");assert('"eu" matches standalone',matchPhrase(t2,t2.split(/\s+/),"eu"));}

console.log("\n=== TEST 3: Negation ===");
{const n=normT;assert('"comprar" negated by nao',!matchPhrase(n("nao quero comprar"),n("nao quero comprar").split(/\s+/),"comprar"));assert('"link" negated by sem',!matchPhrase(n("sem interesse no link"),n("sem interesse no link").split(/\s+/),"link"));assert('"querer" negated by nunca',!matchPhrase(n("nunca vou querer"),n("nunca vou querer").split(/\s+/),"querer"));assert('"link" NOT negated ok',matchPhrase(n("eu quero o link agora"),n("eu quero o link agora").split(/\s+/),"link"));}

console.log("\n=== TEST 4: LGPD Opt-Out ===");
["PARE","nao quero mais","cancela","saia","descadastrar","opt-out","remover"].forEach(m=>assert('"'+m+'" optout',OPTOUT.test(m)));
["quero comprar","manda o link","quanto custa"].forEach(m=>assert('"'+m+'" NOT optout',!OPTOUT.test(m)));

console.log("\n=== TEST 5: Toxicity ===");
["isso e golpe","que merda","fdp mentiroso","filho da puta","vagabundo","idiota","estelionato","fraude"].forEach(m=>assert('"'+m.slice(0,20)+'" toxic',TOXIC.test(m)));
["quero comprar","putativo","tem garantia"].forEach(m=>assert('"'+m+'" not toxic',!TOXIC.test(m)));

console.log("\n=== TEST 6: AUTO Mode ===");
assert("is_live->LS",detectMode("",{is_live:true},"")=== MODES.LS);
assert("is_comment->CB",detectMode("",{is_comment:true},"")=== MODES.CB);
assert("is_qa->QA",detectMode("",{is_qa:true},"")=== MODES.QA);
assert("is_group->GC",detectMode("",{is_group:true},"")=== MODES.GC);
assert("is_dm->DM",detectMode("",{is_dm:true},"")=== MODES.DM);
assert("ch=youtube_live->LS",detectMode("",{},"youtube_live")=== MODES.LS);
assert("url=/live->LS",detectMode("https://yt.com/live",{},"")=== MODES.LS);
assert("ch=whatsapp->DM",detectMode("",{},"whatsapp")=== MODES.DM);
assert("no signals->DM",detectMode("",{},"")=== MODES.DM);

console.log("\n=== TEST 7: public-stats Rate-Limit + Rounding ===");
{const c=simIp(10);let ok=0,bl=0;for(let i=0;i<15;i++){if(c("1.1.1.1"))ok++;else bl++;}
assert("10 allowed",ok===10,"got "+ok);assert("5 blocked",bl===5,"got "+bl);assert("diff IP ok",c("2.2.2.2")===true);
const m=round(47,13,380000);assert("leads 47->mais de 40",m.la==="mais de 40",m.la);assert("sales 13->mais de 10",m.sa==="mais de 10",m.sa);
const pv=(v)=>v==="1"?"public":"private";assert("undefined->private",pv(undefined)==="private");assert("0->private",pv("0")==="private");assert("1->public",pv("1")==="public");}

console.log("\n"+"=".repeat(50));
console.log("Results: "+passed+" passed, "+failed+" failed");
if(failed===0){console.log("ALL V22.1.1 TESTS PASSED");}else{console.error(failed+" TESTS FAILED");process.exit(1);}
