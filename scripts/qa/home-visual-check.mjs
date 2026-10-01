import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || (process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES ? process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright' : 'playwright'));
const repo=fileURLToPath(new URL('../..',import.meta.url));
const empty=process.argv.includes('--empty');
const out=repo+'/docs/qa/home-live-ui-final'+(empty?'-empty':'');
await fs.mkdir(out,{recursive:true});
const env={...process.env,QA_FIXTURE_PORT:empty?'54330':'54329',NEXT_PUBLIC_SUPABASE_URL:empty?'http://127.0.0.1:54330':'http://127.0.0.1:54329',NEXT_PUBLIC_SUPABASE_ANON_KEY:'local-visual-fixture',NEXT_PUBLIC_SITE_URL:'http://127.0.0.1:3102'};
const children=[];
function start(args){const c=spawn(process.execPath,args,{cwd:repo,env,stdio:['ignore','pipe','pipe']});children.push(c);c.stdout.on('data',d=>process.stdout.write(d));c.stderr.on('data',d=>process.stderr.write(d));return c;}
async function ready(url){for(let i=0;i<180;i++){try{const r=await fetch(url);if(r.ok)return;}catch{}await new Promise(r=>setTimeout(r,200));}throw new Error('Server not ready: '+url);}
let browser;
try {
start([repo+'/scripts/qa/home-fixture.mjs',...(empty?['--empty']:[])]);await ready(env.NEXT_PUBLIC_SUPABASE_URL+'/rest/v1/categories');
if(!process.argv.includes('--skip-build')){const build=start([repo+'/node_modules/next/dist/bin/next','build']);const code=await new Promise(r=>build.on('exit',r));if(code!==0)throw new Error('Build failed '+code);}
start([repo+'/node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3102']);await ready('http://127.0.0.1:3102');
browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH || undefined,args:['--no-sandbox','--disable-gpu','--disable-software-rasterizer','--no-zygote','--single-process','--use-gl=disabled'],headless:true});
const p=await browser.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
const results=[];
for(const width of (empty?[375]:[1440,1024,834,768,767,390,375,320])){
await p.setViewportSize({width,height:1000});await p.goto('http://127.0.0.1:3102',{waitUntil:'networkidle'});await p.evaluate(()=>document.fonts.ready);
await p.evaluate(async()=>{for(const img of document.images){img.loading='eager';}await Promise.all([...document.images].map(img=>img.decode().catch(()=>{})));});
const metrics=await p.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,headers:document.querySelectorAll('header').length,mains:document.querySelectorAll('main').length,cards:document.querySelectorAll('.home-categories li').length,font:getComputedStyle(document.querySelector('.home-category-label') || document.body).fontFamily,fields:[...document.querySelectorAll('.home-search input,.home-search select,.home-search button')].map(x=>({width:x.getBoundingClientRect().width,height:x.getBoundingClientRect().height}))}));
if(metrics.scroll>width)throw new Error('Overflow '+JSON.stringify(metrics));
if(metrics.headers!==1||metrics.mains!==1||metrics.cards!==(empty?0:7))throw new Error('Unexpected structure '+JSON.stringify(metrics));
const headings=await p.locator('.home-section-heading h2').evaluateAll(els=>els.map(el=>({text:el.textContent,size:getComputedStyle(el).fontSize,weight:getComputedStyle(el).fontWeight})));
if(new Set(headings.map(h=>h.size+':'+h.weight)).size!==1)throw new Error('Inconsistent headings '+JSON.stringify(headings));
const brokenImages=await p.locator('img').evaluateAll(els=>els.filter(el=>el.complete&&!el.naturalWidth).map(el=>el.src));
if(brokenImages.length)throw new Error('Broken images '+JSON.stringify(brokenImages));
await p.screenshot({path:`${out}/home-${width}.jpg`,fullPage:true,quality:88});
metrics.headings=headings;
if(empty && await p.locator('.home-empty').count()!==4)throw new Error('Missing empty state');
if(!empty){
 const next=p.getByRole('button',{name:'รีวิวถัดไป',exact:true});
 if(await next.isEnabled()) {await next.click();await p.waitForFunction(()=>document.querySelector('#home-reviews').scrollLeft>0);}
 const cta=p.getByRole('link',{name:'สมัครเป็นช่าง',exact:false});
 if(await cta.getAttribute('href')!=='/contractors/register')throw new Error('CTA route');
 if(await p.locator('.home-contractors > li').count()!==5)throw new Error('Contractor cards missing');
 if(await p.locator('.home-article-card').count()!==3)throw new Error('Article cards missing');
}

if(width<1051){await p.getByRole('button',{name:'เมนู',exact:true}).click();await p.getByRole('navigation',{name:'เมนูมือถือ'}).waitFor({state:'visible'});await p.getByRole('button',{name:'ปิดเมนู',exact:true}).click();}
if(!empty){await p.locator('#search-province').selectOption('nakhon-phanom');await p.locator('#search-category').selectOption('ไฟฟ้า');await p.locator('#search-q').fill('ต่อเติมครัว');await Promise.all([p.waitForURL('**/search?**'),p.getByRole('button',{name:'ค้นหาช่าง',exact:true}).click()]);const url=new URL(p.url());if(url.searchParams.get('province')!=='nakhon-phanom'||url.searchParams.get('category')!=='ไฟฟ้า'||url.searchParams.get('q')!=='ต่อเติมครัว')throw new Error('Search params lost');
}results.push({...metrics,search:empty?'empty fixture':'pass'});
}
for(const route of ['/login','/signup','/contractors/register','/search']){await p.goto('http://127.0.0.1:3102'+route,{waitUntil:'networkidle'});if(await p.locator('header').count()!==1||await p.locator('main').count()!==1)throw new Error('Duplicate header on '+route);const overflow=await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth);if(overflow)throw new Error('Route overflow '+route);results.push({route,status:'rendered',overflow});}
if(errors.length)throw new Error('Browser errors: '+errors.join(';'));
await fs.writeFile(out+'/results.json',JSON.stringify({results,errors},null,2));console.log('QA_RESULTS '+JSON.stringify({results,errors}));
} finally {await browser?.close();for(const c of children)c.kill('SIGTERM');}
