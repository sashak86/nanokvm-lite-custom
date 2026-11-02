// Isolated browser checks: every HTTP request is mocked; no HID reaches hardware.
const puppeteer=require(process.env.PUPPETEER_MODULE||'puppeteer');
const fs=require('fs'),path=require('path');
const base=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(base,'m.html'),'utf8'),inject=fs.readFileSync(path.join(base,'custom/inject.html'),'utf8');
let passed=0;function check(v,t){if(!v)throw Error(t);console.log('PASS '+t);passed++}
(async()=>{
 const browser=await puppeteer.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
 for(const size of [{width:320,height:640},{width:390,height:844},{width:844,height:390},{width:1280,height:800}]){
  const p=await browser.newPage();await p.setViewport({...size,isMobile:size.width<900,hasTouch:size.width<900});
  const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.setRequestInterception(true);
  p.on('request',r=>r.respond({status:200,contentType:'text/html',body:html}));
  await p.goto('http://qa.test/m.html?demo');await p.evaluate(()=>{setKeys(true);showPill(true)});
  const metrics=await p.evaluate(()=>{
   const rect=e=>{const r=e.getBoundingClientRect();return {w:r.width,h:r.height,l:r.left,r:r.right,t:r.top,b:r.bottom}};
   return {pill:[...document.querySelectorAll('#pill button')].map(rect),mods:[...document.querySelectorAll('#modrow>*')].map(rect),keys:[...document.querySelectorAll('#keys button')].map(rect),bar:rect(document.querySelector('#pill')),width:innerWidth,scroll:document.documentElement.scrollWidth};
  });
  check(metrics.pill.every(r=>r.w>=72&&r.h>=64),size.width+' pill targets >=72x64');
  check(metrics.mods.every(r=>r.w>=64&&r.h>=64),size.width+' modifier targets >=64x64');
  check(metrics.keys.every(r=>r.w>=88&&r.h>=88),size.width+' function targets >=88x88');
  check(metrics.bar.l>=0&&metrics.bar.r<=size.width,size.width+' toolbar fits width');
  check(metrics.scroll===size.width,size.width+' no page horizontal overflow');
  const scroll=await p.evaluate(()=>{
   const out={};for(const id of ['pill','modrow','keys']){const el=document.getElementById(id);el.scrollLeft=el.scrollWidth;const r=el.lastElementChild.getBoundingClientRect(),box=el.getBoundingClientRect();out[id]=r.right<=box.right+1&&r.left>=box.left-1;el.scrollLeft=0;}return out;
  });
  check(Object.values(scroll).every(Boolean),size.width+' last controls reachable by horizontal scroll');
  check(await p.$eval('#pill',e=>getComputedStyle(e).backgroundColor)==='rgba(10, 14, 24, 0.24)',size.width+' more transparent pill');
  await p.click('#bm');const sheet=await p.$eval('#sm',e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height,view:innerHeight,buttons:[...e.querySelectorAll('button')].map(b=>b.getBoundingClientRect().height)}});
  check(sheet.top>=96&&sheet.bottom<=sheet.view&&sheet.buttons.every(h=>h>=48),size.width+' sheet fits with finger controls');
  await p.evaluate(()=>{closeSheets();showPill(true)});
  if(process.env.QA_ARTIFACTS){fs.mkdirSync(process.env.QA_ARTIFACTS,{recursive:true});await p.screenshot({path:path.join(process.env.QA_ARTIFACTS,`demo-${size.width}.png`)});}
  check(errors.length===0,size.width+' no JS errors');await p.close();
 }
 for(const scenario of ['desktop','mobile','old-classic','explicit-classic','login','no-storage-login']){
  const p=await browser.newPage();let authorized=!scenario.includes('login');await p.setViewport({width:390,height:844,isMobile:scenario==='mobile',hasTouch:scenario==='mobile'});
  await p.evaluateOnNewDocument((scenario)=>{window.WebSocket=class{constructor(){this.readyState=0}close(){}};if(scenario==='old-classic')sessionStorage.setItem('kvm-ui','classic');if(scenario==='no-storage-login')Object.defineProperty(window,'sessionStorage',{get(){throw Error('blocked')}})},scenario);
  await p.setRequestInterception(true);p.on('request',r=>{const u=new URL(r.url());if(u.pathname==='/api/vm/hdmi')return r.respond({status:authorized?200:401,contentType:'application/json',body:JSON.stringify({code:0,data:{signal:false}})});if(u.pathname==='/m.html')return r.respond({status:200,contentType:'text/html',body:html.replace("const demo=location.search.includes('demo')","const demo=true")});return r.respond({status:200,contentType:'text/html',body:'<!doctype html><head>'+inject+'</head><body>STOCK LOGIN</body>'});});
  const query=scenario==='explicit-classic'?'?classic=1':scenario.includes('login')?'?login=1':'';
  await p.goto('http://qa.test/'+query);await new Promise(r=>setTimeout(r,300));
  if(scenario==='explicit-classic'){check(new URL(p.url()).search==='?classic=1','intentional stock remains accessible');}
  else if(scenario.includes('login')){check(!p.url().includes('/m.html'),scenario+' waits for auth');authorized=true;await p.waitForFunction(()=>location.pathname==='/m.html',{timeout:5000});check(true,scenario+' returns to custom after auth');}
  else{await p.waitForFunction(()=>location.pathname==='/m.html');check(true,scenario+' defaults to custom');}
  await p.close();
 }
 console.log('TOTAL '+passed+' PASS');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
