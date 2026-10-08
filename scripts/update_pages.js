import fs from 'fs';
import path from 'path';

const workerPath = path.resolve('worker.js');
let code = fs.readFileSync(workerPath, 'utf8');

const newPayPage = `function payPage() {
  return \`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Pagar com Pix</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700&family=Hanken+Grotesk:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap">
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
<style>
  :root {
    --bg: #F9F9FA; --ground: #E6E6EA; --surface: #FFFFFF; --fg: #0A0A0A; --muted: #5A5A62;
    --line: #0A0A0A; --hair: #D6D6DC; --em: #00C27A; --em-ink: #00774C; --on-em: #0A0A0A;
    --sk: #E4E4E9; --sk-hi: #C6C6CE; --shadow: #0A0A0A;
    --f-display: 'Outfit', system-ui, sans-serif;
    --f-body: 'Hanken Grotesk', system-ui, -apple-system, 'Segoe UI', sans-serif;
    --f-mono: 'JetBrains Mono', ui-monospace, monospace;
    --spring: cubic-bezier(.34, 1.56, .64, 1);
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --bg: #0A0A0A; --ground: #000000; --surface: #151517; --fg: #F4F4F5; --muted: #9C9CA6;
      --line: #F4F4F5; --hair: #28282D; --em: #2BE59A; --em-ink: #2BE59A; --on-em: #0A0A0A;
      --sk: #1E1E22; --sk-hi: #3A3A42; --shadow: #2A2A30;
      color-scheme: dark;
    }
  }
  :root[data-theme="dark"] {
    --bg: #0A0A0A; --ground: #000000; --surface: #151517; --fg: #F4F4F5; --muted: #9C9CA6;
    --line: #F4F4F5; --hair: #28282D; --em: #2BE59A; --em-ink: #2BE59A; --on-em: #0A0A0A;
    --sk: #1E1E22; --sk-hi: #3A3A42; --shadow: #2A2A30;
    color-scheme: dark;
  }
  *, *::before, *::after { box-sizing: border-box; }
  body { display: flex; justify-content: center; align-items: flex-start; padding-block: 40px; padding-inline: 16px; background: var(--ground); color: var(--fg); font-family: var(--f-body); font-size: 15px; line-height: 1.45; -webkit-font-smoothing: antialiased; }
  button { font: inherit; color: inherit; cursor: pointer; }
  :focus-visible { outline: 3px solid var(--em-ink); outline-offset: 3px; }
  h1, h2, p, ul, ol { margin: 0; padding: 0; }
  svg { display: block; }
  .phone { width: 100%; max-width: 430px; min-width: 0; padding-inline: 20px; padding-block: 18px 28px; background: var(--bg); border: 2px solid var(--line); border-radius: 32px; box-shadow: 10px 10px 0 var(--shadow); display: flex; flex-direction: column; gap: 20px; }
  @media (max-width: 470px) { body { padding: 0; background: var(--bg); } .phone { border: 0; border-radius: 0; box-shadow: none; min-height: 100vh; } }
  .eyebrow { font-family: var(--f-mono); font-size: 11px; font-weight: 500; letter-spacing: .09em; text-transform: uppercase; color: var(--muted); }
  .topbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .brand { display: flex; align-items: center; gap: 10px; font-family: var(--f-display); font-weight: 700; font-size: 20px; letter-spacing: -.01em; }
  .mark { width: 22px; height: 22px; background: var(--fg); display: grid; place-items: center; }
  .mark::after { content: ''; width: 9px; height: 9px; background: var(--em); }
  .theme { position: relative; width: 60px; height: 32px; padding: 0 6px; border: 2px solid var(--line); border-radius: 999px; background: var(--surface); display: flex; align-items: center; justify-content: space-between; color: var(--muted); }
  .theme .thumb { position: absolute; top: 2px; left: 2px; width: 24px; height: 24px; border-radius: 50%; background: var(--fg); transition: transform .3s ease; }
  .theme[aria-checked="true"] .thumb { transform: translateX(28px); }
  .trust { display: grid; grid-template-columns: 46px 1fr; border: 2px solid var(--line); border-radius: 14px; overflow: hidden; background: var(--surface); }
  .shield { background: var(--em); color: var(--on-em); display: grid; place-items: center; }
  .trust div { padding: 10px 14px; }
  .trust strong { font-family: var(--f-display); font-weight: 600; font-size: 15px; }
  .trust span { font-size: 12px; color: var(--muted); display: block; }
  .field { display: flex; flex-direction: column; gap: 6px; }
  .field label { font-family: var(--f-mono); font-size: 11px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; }
  .field input { width: 100%; padding: 13px 15px; border-radius: 12px; border: 2px solid var(--line); background: var(--surface); color: var(--fg); font-family: var(--f-body); font-size: 15px; outline: none; }
  .field input:focus { border-color: var(--em-ink); }
  .prod-card { border: 2px solid var(--line); border-radius: 14px; padding: 14px; background: var(--surface); margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: transform .2s ease, border-color .2s ease; }
  .prod-card:hover { border-color: var(--em-ink); transform: translateY(-1px); }
  .prod-card.sel { border-color: var(--em); background: var(--bg); box-shadow: 4px 4px 0 var(--line); }
  .prod-card b { font-family: var(--f-display); font-size: 18px; color: var(--em-ink); }
  #qr { display: none; background: #FFF; border-radius: 16px; padding: 16px; margin: 16px auto; width: fit-content; border: 2px solid var(--line); box-shadow: 6px 6px 0 var(--shadow); }
  #st { text-align: center; font-weight: 700; font-family: var(--f-mono); font-size: 13px; min-height: 24px; margin: 12px 0; color: var(--fg); }
  #st.ok { color: var(--em-ink); }
  .btn-action { width: 100%; min-height: 52px; padding: 12px 18px; background: var(--fg); color: var(--bg); border: 2px solid var(--line); border-radius: 14px; font-family: var(--f-display); font-weight: 700; font-size: 16px; box-shadow: 4px 4px 0 var(--em); cursor: pointer; margin-top: 10px; display: flex; align-items: center; justify-content: center; gap: 8px; transition: transform .2s ease; }
  .btn-action:active { transform: translate(2px, 2px); box-shadow: 2px 2px 0 var(--em); }
  .foot { text-align: center; color: var(--muted); font-size: 11px; font-family: var(--f-mono); margin-top: 10px; border-top: 1px solid var(--hair); padding-top: 12px; }
</style>
</head>
<body>
<main class="phone">
  <header class="topbar">
    <div class="brand"><span class="mark" aria-hidden="true"></span><span id="h">ChatPay</span></div>
    <button class="theme" id="theme" type="button" role="switch" aria-checked="false" aria-label="Modo escuro" onclick="toggleTheme()">
      <span class="thumb" aria-hidden="true"></span>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4 12h2M20 12h2"/></svg>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
    </button>
  </header>

  <div class="trust">
    <span class="shield" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6z"/><path d="m8.8 12.2 2.2 2.2 4.2-4.6"/></svg></span>
    <div>
      <strong>🔒 Checkout Seguro Pix</strong>
      <span>Aprovação instantânea de ponta a ponta</span>
    </div>
  </div>

  <div id="email-box" class="field" style="display:none">
    <label for="buyer-email">Seu Email para Receber o Acesso</label>
    <input type="email" id="buyer-email" placeholder="voce@exemplo.com.br" required>
  </div>

  <div id="list"></div>
  <div id="qr"></div>
  <div id="st"></div>

  <button id="paid-btn" class="btn-action" style="display:none" onclick="ping()">✅ Já paguei</button>
  <button id="copy" class="btn-action" style="display:none" onclick="cp()">📋 Copiar Pix copia-e-cola</button>
  <button id="regen-btn" class="btn-action" style="display:none" onclick="location.href=location.pathname+'?d='+D">🔄 Gerar novo QR</button>

  <div id="fallback" style="display:none;text-align:center;margin-top:12px;font-size:13px;color:var(--muted)"></div>
  <div id="deliver" style="display:none;text-align:center;margin-top:12px"></div>

  <p class="foot">🔒 Processado com infraestrutura segura ChatPay</p>
</main>

<script>
var D=new URLSearchParams(location.search).get('d')||'';var REF=new URLSearchParams(location.search).get('ref')||'';var LEAD=new URLSearchParams(location.search).get('lead_id')||'';var PSEL=new URLSearchParams(location.search).get('p')||'';var TX=new URLSearchParams(location.search).get('tx')||'';var PUB=null,txid=null,payload='',prodSel=null,timer=null,pollCount=0,buyerEmail='';

function toggleTheme(){
  var root=document.documentElement;
  var isDark=root.dataset.theme==='dark';
  root.dataset.theme=isDark?'light':'dark';
  document.getElementById('theme').setAttribute('aria-checked',(!isDark).toString());
}

async function load(){
  PUB=await(await fetch('/api/pub?d='+encodeURIComponent(D))).json();
  if(PUB.error){document.getElementById('st').innerText='❌ '+PUB.error;return;}
  document.getElementById('h').innerText='⚡ '+(PUB.brand||'ChatPay');
  if((PUB.products||[]).length>0){document.getElementById('email-box').style.display='flex';}
  document.getElementById('list').innerHTML=(PUB.products||[]).map(function(p){
    return '<div class="prod-card'+(PSEL&&String(p.id)===PSEL?' sel':'')+'" id="pl-'+p.id+'" onclick="buy('+p.id+')"><span><b>'+p.name+'</b></span><b>R$ '+(p.cents/100).toFixed(2)+'</b></div>';
  }).join('')||'<p class="eyebrow" style="text-align:center">loja sem produtos ainda</p>';
  if(PSEL&&(PUB.products||[]).some(function(p){return String(p.id)===PSEL;})){buy(PSEL);}
}

async function buy(id){
  buyerEmail=document.getElementById('buyer-email').value.trim();
  if(!buyerEmail||!buyerEmail.includes('@')){document.getElementById('st').innerText='❌ Digite seu email para receber o acesso.';return;}
  prodSel=(PUB.products||[]).filter(function(p){return String(p.id)===String(id);})[0];
  if(!prodSel)return;
  document.getElementById('st').innerText='Gerando Pix...';
  var r=await fetch('/chatpay/charge',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({amount:(prodSel.cents/100).toFixed(2),desc:prodSel.name,dom:D,brand:PUB.brand,ref:REF,lead_id:LEAD,buyer_email:buyerEmail})});
  var d=await r.json();
  if(d.error){document.getElementById('st').innerText='❌ '+d.error;return;}
  txid=d.txid;payload=d.payload;
  var q=document.getElementById('qr');q.style.display='block';q.innerHTML='';new QRCode(q,{text:payload,width:220,height:220});
  document.getElementById('copy').style.display='flex';document.getElementById('paid-btn').style.display='flex';document.getElementById('email-box').style.display='none';document.getElementById('list').style.display='none';
  document.getElementById('st').innerText='⏳ Escaneie e pague R$ '+(prodSel.cents/100).toFixed(2);
  if(timer)clearInterval(timer);pollCount=0;timer=setInterval(poll,5000);poll();
}

function cp(){
  navigator.clipboard.writeText(payload);
  var btn=document.getElementById('copy');
  btn.innerText='✅ Código Copiado!';
  setTimeout(function(){btn.innerText='📋 Copiar Pix copia-e-cola';},2500);
}

async function ping(){document.getElementById('st').innerText='⏳ Verificando seu Pix...';pollCount=0;if(timer)clearInterval(timer);timer=setInterval(poll,5000);poll();}

async function poll(){
  if(!txid)return;
  var r=await fetch('/api/tx-status?tx='+txid);
  var d=await r.json();pollCount++;
  if(d.status==='paid'){
    clearInterval(timer);document.getElementById('st').className='ok';document.getElementById('qr').style.display='none';document.getElementById('copy').style.display='none';document.getElementById('paid-btn').style.display='none';document.getElementById('fallback').style.display='none';document.getElementById('st').innerText='✅ PAGAMENTO CONFIRMADO';
    var dlvHtml='<p style="font-size:13px;color:var(--muted);margin-top:8px">Enviamos o comprovante e o acesso para '+(buyerEmail||'seu email')+'.</p>';
    if(prodSel&&prodSel.deliver){dlvHtml='<a href="'+prodSel.deliver+'" class="btn-action" style="text-decoration:none;margin-bottom:10px;background:var(--em);color:var(--on-em)">🚀 ACESSAR MEU PRODUTO</a>'+dlvHtml;}
    document.getElementById('deliver').style.display='block';document.getElementById('deliver').innerHTML=dlvHtml;checkSign();
  }
  else if(d.status==='expired'){
    clearInterval(timer);document.getElementById('st').innerText='❌ Este QR expirou. Gerar novo?';document.getElementById('qr').style.display='none';document.getElementById('copy').style.display='none';document.getElementById('paid-btn').style.display='none';document.getElementById('regen-btn').style.display='flex';
  }
  else if(d.status==='pending'){
    document.getElementById('st').innerText='Ainda não identificamos. Assim que o banco confirmar, liberamos na hora. Pode deixar esta página aberta.';
  }
  if(pollCount>=36 && d.status!=='paid'){
    clearInterval(timer);document.getElementById('fallback').style.display='block';document.getElementById('fallback').innerHTML='Não caiu ainda? Isso é normal em alguns bancos (até 5 min). Seu pagamento NÃO foi perdido: assim que confirmar, liberamos automaticamente e avisamos em '+(buyerEmail||'seu email')+'.<br><a href="https://wa.me/?text=Oi" style="color:var(--em-ink);margin-top:8px;display:inline-block;font-weight:700">Falar com o vendedor</a>';
  }
}

async function checkSign(){
  try{
    var r=await fetch('/api/sign-status?txid='+encodeURIComponent(txid));
    var d=await r.json();
    if(d.sign_status==='pending'&&d.sign_url){document.getElementById('deliver').style.display='block';document.getElementById('deliver').innerHTML+='<p style="margin-bottom:8px">✅ Pago! Agora assine o contrato para liberar o acesso.</p><a href="'+d.sign_url+'" target="_blank" class="btn-action" style="text-decoration:none">🚀 ASSINAR CONTRATO</a>';}
    else if(d.sign_status==='signed'&&d.deliver_url){document.getElementById('deliver').style.display='block';document.getElementById('deliver').innerHTML+='<a href="'+d.deliver_url+'" target="_blank" class="btn-action" style="text-decoration:none">🚀 ACESSAR CONTRATO ASSINADO</a>';}
  }catch(e){}
}

if(TX){txid=TX;document.getElementById('email-box').style.display='none';document.getElementById('list').style.display='none';document.getElementById('st').innerText='Verificando pagamento...';pollCount=0;if(timer)clearInterval(timer);timer=setInterval(poll,5000);poll();}
else{load();}
</script>
</body>
</html>\`;
}`;

const newStartPage = `function startPage() {
  return \`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>ChatPay ⚡ Ative sua IA de Vendas</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap">
<style>
  :root {
    --bg: #0A0A0A; --fg: #F4F4F2; --muted: #9E9EA6; --hair: #27272B;
    --y: #FAFF00; --on-y: #0A0A0A; --panel: #131315;
    --f-display: 'Instrument Serif', Georgia, serif;
    --f-body: 'Geist', system-ui, sans-serif;
    --f-mono: 'Geist Mono', monospace;
  }
  *, *::before, *::after { box-sizing: border-box; }
  body { background: var(--bg); color: var(--fg); font-family: var(--f-body); font-size: 16px; line-height: 1.5; margin: 0; min-height: 100vh; display: flex; justify-content: center; align-items: center; padding: 24px; }
  .w { max-width: 520px; width: 100%; background: #131315; border: 1px solid #27272B; border-radius: 24px; padding: 32px; box-shadow: 0 20px 40px rgba(0,0,0,0.6); }
  h1 { font-family: var(--f-display); font-size: 42px; font-weight: 400; margin-bottom: 8px; color: #FFF; line-height: 1.1; }
  h1 em { font-style: italic; color: var(--y); }
  .sub { color: var(--muted); font-size: 15px; margin-bottom: 24px; }
  .field { margin-bottom: 16px; }
  label { font-family: var(--f-mono); font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); display: block; margin-bottom: 6px; }
  input { width: 100%; padding: 14px; border-radius: 12px; border: 1px solid #333; background: #0A0A0A; color: #FFF; font-size: 16px; outline: none; }
  input:focus { border-color: var(--y); }
  button.cta { width: 100%; background: var(--y); color: var(--on-y); border: 0; padding: 16px; border-radius: 12px; font-family: var(--f-body); font-weight: 600; font-size: 17px; cursor: pointer; margin-top: 10px; transition: transform 0.2s; }
  button.cta:active { transform: scale(0.98); }
  #out { display: none; margin-top: 24px; background: #0A0A0A; border: 1px solid var(--y); border-radius: 16px; padding: 20px; }
  #out pre { white-space: pre-wrap; word-break: break-all; background: #131315; padding: 12px; border-radius: 10px; font-family: var(--f-mono); font-size: 12px; margin: 12px 0; color: var(--y); }
  .ok { color: #2BE59A; font-weight: 700; font-size: 16px; }
  .btn2 { width: 100%; background: #222; color: #FFF; border: 1px solid #444; padding: 14px; border-radius: 10px; font-weight: 600; cursor: pointer; margin-top: 8px; }
</style>
</head>
<body>
<div class="w">
  <h1>⚡ ChatPay <em>IA</em></h1>
  <p class="sub">Pix dentro do chat com confirmação automática. Ative em 60 segundos, sem desenvolvedor.</p>
  <div class="field"><label>Nome da sua loja ou marca</label><input id="b" placeholder="Ex.: Ateliê Sol"></div>
  <div class="field"><label>Seu domínio ou rede social</label><input id="d" placeholder="Ex.: minhaloja.com.br ou instagram.com/loja"></div>
  <div class="field"><label>Email de trabalho</label><input id="e" type="email" placeholder="voce@sualoja.com.br"></div>
  <button class="cta" onclick="go()">⚡ ATIVAR MINHA IA AGORA</button>
  <div id="out">
    <p class="ok">✅ Conta criada com sucesso!</p>
    <button class="btn2" onclick="abrirPainel()">🔒 ABRIR MEU PAINEL DE CONTROLE</button>
    <pre id="sn"></pre>
    <p style="font-size:12px;color:var(--muted)">Trial 30 dias grátis. No painel você configura seus produtos e chave Pix.</p>
  </div>
</div>
<script>
var TOKEN='';
async function go(){
  var b=document.getElementById('b').value.trim();
  var d=document.getElementById('d').value.trim();
  var e=document.getElementById('e').value.trim();
  if(!b || !d || !e){alert('❌ Preencha todos os campos para ativar.');return;}
  var r=await fetch('/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({domain:d,brand:b,email:e})});
  var res=await r.json();
  if(res.error){alert('❌ '+res.error);return;}
  TOKEN=res.token;
  document.getElementById('sn').innerText=res.snippet;
  document.getElementById('out').style.display='block';
}
function abrirPainel(){location.href='/dash?token='+encodeURIComponent(TOKEN);}
</script>
</body>
</html>\`;
}`;

const startPay = code.indexOf('function payPage() {');
const startExport = code.indexOf('export default {');

if (startPay === -1 || startExport === -1) {
  console.error('Could not locate bounds in worker.js');
  process.exit(1);
}

code = code.slice(0, startPay) + newPayPage + '\n\n' + newStartPage + '\n\n' + code.slice(startExport);
fs.writeFileSync(workerPath, code);
console.log('Successfully updated payPage and startPage in worker.js');
