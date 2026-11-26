import fs from 'node:fs';
import crypto from 'node:crypto';
const SITE='https://apdalrhmanalpop.github.io/news/';
const SECTIONS={world:['World','العالم'],eg:['Egypt','مصر'],sa:['Saudi Arabia','السعودية'],ae:['UAE','الإمارات'],us:['USA','أمريكا'],uk:['UK','بريطانيا'],in:['India','الهند'],de:['Germany','ألمانيا'],fr:['France','فرنسا'],tr:['Turkey','تركيا'],jp:['Japan','اليابان']};
// [source, url, lang, section]
const FEEDS=[
['BBC News','https://feeds.bbci.co.uk/news/world/rss.xml','en','world'],
['Al Jazeera','https://www.aljazeera.com/xml/rss/all.xml','en','world'],
['NYT World','https://rss.nytimes.com/services/xml/rss/nyt/World.xml','en','world'],
['NPR','https://feeds.npr.org/1004/rss.xml','en','world'],
['DW','https://rss.dw.com/rdf/rss-en-world','en','world'],
['France 24','https://www.france24.com/en/rss','en','world'],
['Sky News','https://feeds.skynews.com/feeds/rss/world.xml','en','world'],
['الجزيرة','https://www.aljazeera.net/aljazeerarss/a7c186be-1baa-4bd4-9d80-a84db769f779/73d0e1b4-532f-45ef-b135-bfdb00d3d2b7','ar','world'],
['BBC عربي','https://feeds.bbci.co.uk/arabic/rss.xml','ar','world'],
['فرانس 24','https://www.france24.com/ar/rss','ar','world'],
['DW عربية','https://rss.dw.com/xml/rss-ar-all','ar','world'],
['سكاي نيوز عربية','https://www.skynewsarabia.com/web/rss','ar','world'],
['Daily News Egypt','https://dailynewsegypt.com/feed/','en','eg'],
['Arab News','https://www.arabnews.com/rss.xml','en','sa'],
['Saudi Gazette','https://saudigazette.com.sa/rssFeed/74','en','sa'],
['The National','https://www.thenationalnews.com/arc/outboundfeeds/rss/?outputType=xml','en','ae'],
['NPR US','https://feeds.npr.org/1001/rss.xml','en','us'],
['NYT US','https://rss.nytimes.com/services/xml/rss/nyt/US.xml','en','us'],
['BBC UK','https://feeds.bbci.co.uk/news/uk/rss.xml','en','uk'],
['Sky News UK','https://feeds.skynews.com/feeds/rss/uk.xml','en','uk'],
['NDTV','https://feeds.feedburner.com/ndtvnews-india-news','en','in'],
['DW Germany','https://rss.dw.com/rdf/rss-en-ger','en','de'],
['France 24 France','https://www.france24.com/en/france/rss','en','fr'],
['Daily Sabah','https://www.dailysabah.com/rssFeed/turkey','en','tr'],
['Japan Times','https://www.japantimes.co.jp/feed/','en','jp'],
['NHK','https://www3.nhk.or.jp/rss/news/cat0.xml','en','jp'],
];
const dec=s=>s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#0?39;|&apos;/g,"'").replace(/&#x([0-9a-f]+);/gi,(m,h)=>String.fromCodePoint(parseInt(h,16))).replace(/&#(\d+);/g,(m,d)=>String.fromCodePoint(+d)).replace(/\[?\u2026\]?\s*The post .*? appeared first on .*$/i,'...').replace(/\s+The post .*? appeared first on .*$/i,'').replace(/\s+/g,' ').trim();
const tag=(b,t)=>{const m=b.match(new RegExp('<'+t+'[^>]*>([\\s\\S]*?)</'+t+'>','i'));return m?dec(m[1]):''};
const img=b=>{const m=b.match(/<(?:media:content|media:thumbnail|enclosure)[^>]*url="([^"]+)"/i);return m?m[1]:''};
const E=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const hid=u=>crypto.createHash('sha1').update(u).digest('hex').slice(0,10);
const items=[];const status={};
await Promise.all(FEEDS.map(async([src,url,lang,sec])=>{
 try{const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 NewsAggregator'},signal:AbortSignal.timeout(20000)});
  if(!r.ok)throw new Error(r.status);const x=await r.text();
  const blocks=x.match(/<item[\s>][\s\S]*?<\/item>/gi)||[];let n=0;
  for(const b of blocks.slice(0,25)){
   let link=tag(b,'link');const title=tag(b,'title');if(!title||!link)continue;
   const d=Date.parse(tag(b,'pubDate')||tag(b,'dc:date')||'')||Date.now();
   let sum=tag(b,'description');if(sum.length>400)sum=sum.slice(0,397).replace(/\s\S*$/,'')+'...';
   items.push({t:title,s:sum,u:link,src,d,i:img(b),l:lang,c:sec,id:hid(link)});n++;}
  status[src]=n;}catch(e){status[src]='error '+e.message;}
}));
const seen=new Set();
const out=items.sort((a,b)=>b.d-a.d).filter(i=>{const k=i.t.toLowerCase().slice(0,60);if(seen.has(k))return false;seen.add(k);return i.d<=Date.now()+3600e3}).slice(0,420);
// ---- AI articles ----
let arts={};try{arts=JSON.parse(fs.readFileSync('articles.json','utf8'))}catch{}
const KEY=process.env.GEMINI_API_KEY||'';
const MODELS=['gemini-3.5-flash-lite','gemini-3.1-flash-lite'];
const day=new Date(Date.now()-8*3600e3).toISOString().slice(0,10); // Pacific-ish day
let meta={};try{meta=JSON.parse(fs.readFileSync('gen-meta.json','utf8'))}catch{}
if(meta.day!==day)meta={day,count:0,errors:0};
const DAILY_CAP=300,PER_RUN=3;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function gen(it){
 const lang=it.l==='ar'?'Arabic':'English';
 const prompt=`You are a news editor. Write an original short news article in ${lang} based ONLY on the facts in the headline and summary below.
Rules: 60 to 180 words, 1 to 3 short paragraphs. Do not add any fact, name, number, quote, place or background that is not in the headline or summary. If the summary is thin, write fewer words rather than guessing. Rephrase everything in your own words, never copy a full sentence. Neutral tone. Do not mention that you are an AI or that you were given a summary.
Return JSON only: {"headline": string (new wording, max 110 chars), "paragraphs": string[]}.
Outlet: ${it.src}
Headline: ${it.t}
Summary: ${it.s||'(none)'}`;
 for(const m of MODELS){
  const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`,{method:'POST',headers:{'content-type':'application/json','x-goog-api-key':KEY},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{responseMimeType:'application/json',temperature:0.3}}),signal:AbortSignal.timeout(60000)});
  if(r.status===404)continue;
  if(!r.ok){throw new Error('gemini '+r.status)}
  const j=await r.json();const txt=j.candidates?.[0]?.content?.parts?.map(p=>p.text).join('')||'';
  const o=JSON.parse(txt.replace(/^```json|```$/g,''));
  if(!o.headline||!Array.isArray(o.paragraphs)||!o.paragraphs.length)throw new Error('bad json');
  return {h:String(o.headline).slice(0,160),p:o.paragraphs.map(String).slice(0,4),m};
 }
 throw new Error('no model');
}
let made=0;const log=[];
if(KEY){
 // round robin over sections, newest first
 const by={};for(const i of out){if(!arts[i.id]&&(i.s||'').length>40)(by[i.c]=by[i.c]||[]).push(i)}
 const order=[];let more=true;for(let k=0;more;k++){more=false;for(const s of Object.keys(SECTIONS)){if(by[s]&&by[s][k]){order.push(by[s][k]);more=true}}}
 for(const it of order){
  if(made>=PER_RUN||meta.count>=DAILY_CAP||meta.errors>=8)break;
  try{const a=await gen(it);arts[it.id]={h:a.h,p:a.p,c:it.c,l:it.l,src:it.src,u:it.u,d:it.d,g:Date.now(),m:a.m};made++;meta.count++;}
  catch(e){meta.errors++;log.push(it.id+' '+e.message);if(/429/.test(e.message))break;}
  await sleep(5000);
 }
}
fs.writeFileSync('gen-meta.json',JSON.stringify(meta));
// trim old
const ids=Object.keys(arts).sort((a,b)=>arts[b].d-arts[a].d);ids.slice(1500).forEach(k=>delete arts[k]);
fs.writeFileSync('articles.json',JSON.stringify(arts));
for(const it of out)if(arts[it.id])it.a=1;
fs.writeFileSync('news.json',JSON.stringify({updated:Date.now(),status,gen:{day,count:meta.count,errors:meta.errors,made,log},items:out}));
console.log(status,out.length,'articles',Object.keys(arts).length,'made',made,log);
// ---- pages ----
const css='<link rel="stylesheet" href="%style.css">';
const nav=(base)=>'<nav class="secnav"><a href="'+base+'">Home</a>'+Object.entries(SECTIONS).map(([k,[n,ar]])=>`<a href="${base}c/${k}.html">${n} <span>${ar}</span></a>`).join('')+'</nav>';
const head=(base,title,desc,canon,extra='')=>`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${E(title)}</title><meta name="description" content="${E(desc)}"><link rel="canonical" href="${canon}"><meta name="robots" content="index,follow,max-image-preview:large"><meta property="og:title" content="${E(title)}"><meta property="og:description" content="${E(desc)}"><meta property="og:url" content="${canon}"><meta property="og:type" content="article"><link rel="icon" href="${base}icon.svg"><link rel="stylesheet" href="${base}style.css">${extra}</head><body><header><a class="logo" href="${base}" style="text-decoration:none;color:inherit">World<b>Live</b>News</a><div class="sp"></div><div id="gt"></div></header>${nav(base)}<main>`;
const foot=(base)=>`</main><footer>World Live News. Articles are short briefs written by AI from public headlines and summaries of the cited source. Always check the original source.</footer><script src="${base}config.js"></script><script src="${base}site.js"></script><script>(function(){var C=window.NEWS_CONFIG;if(!C||!C.API_URL)return;var v=localStorage.vid;if(!v){v=Math.random().toString(36).slice(2)+Date.now().toString(36);localStorage.vid=v}function h(){fetch(C.API_URL+'?'+new URLSearchParams({action:'hit',vid:v,page:location.pathname,ref:document.referrer}),{mode:'no-cors'}).catch(function(){})}h();setInterval(h,60000)})();function googleTranslateElementInit(){new google.translate.TranslateElement({pageLanguage:'en',layout:google.translate.TranslateElement.InlineLayout.SIMPLE,autoDisplay:false},'gt')}</script><script src="https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit" async></script></body></html>`;
fs.mkdirSync('a',{recursive:true});fs.mkdirSync('c',{recursive:true});
const iso=t=>new Date(t).toISOString();
for(const [id,a] of Object.entries(arts)){
 const f=`a/${id}.html`;if(fs.existsSync(f))continue;
 const canon=SITE+f;const desc=a.p[0].slice(0,155);const sn=SECTIONS[a.c]||SECTIONS.world;
 const ld={"@context":"https://schema.org","@type":"NewsArticle",headline:a.h,datePublished:iso(a.d),dateModified:iso(a.g),inLanguage:a.l,articleSection:sn[0],mainEntityOfPage:canon,author:{"@type":"Organization",name:"World Live News"},publisher:{"@type":"Organization",name:"World Live News",url:SITE},isBasedOn:a.u};
 const body=`<article data-id="${id}" dir="${a.l==='ar'?'rtl':'ltr'}"><div class="meta"><a href="../c/${a.c}.html"><b>${sn[0]}</b></a> · <time datetime="${iso(a.d)}">${new Date(a.d).toUTCString().slice(5,22)} UTC</time></div><h1>${E(a.h)}</h1>${a.p.map(p=>`<p class="ap">${E(p)}</p>`).join('')}<div class="src">Source: <a href="${E(a.u)}" rel="nofollow noopener" target="_blank">${E(a.src)}</a>. This brief was written by AI in our own words from the outlet's public headline and summary. Read the full report at the source.</div></article>`;
 fs.writeFileSync(f,head('../',a.h+' | World Live News',desc,canon,'<script type="application/ld+json">'+JSON.stringify(ld).replace(/</g,'\\u003c')+'</script>')+body+foot('../'));
}
const card=(i,base)=>{const a=arts[i.id];const href=a?`${base}a/${i.id}.html`:E(i.u);const ext=a?'':' target="_blank" rel="noopener"';return `<a class="card" dir="auto" data-id="${i.id}" data-c="${i.c}" data-l="${i.l}" href="${href}"${ext}>${i.i?`<img loading="lazy" src="${E(i.i)}" alt="">`:''}<div><h3>${E(a?a.h:i.t)}</h3><p>${E(a?a.p[0].slice(0,200):i.s)}</p><div class="meta"><b>${E(i.src)}</b> · <time datetime="${iso(i.d)}">${new Date(i.d).toUTCString().slice(5,22)} UTC</time>${a?' · <em>article</em>':''}</div></div></a>`};
for(const [k,[n,ar]] of Object.entries(SECTIONS)){
 const L=out.filter(i=>i.c===k).slice(0,60);
 const canon=SITE+`c/${k}.html`;
 const ld={"@context":"https://schema.org","@type":"CollectionPage",name:n+' news',url:canon};
 fs.writeFileSync(`c/${k}.html`,head('../',`${n} news today | World Live News`,`Latest ${n} headlines and short articles with source links, updated every few minutes.`,canon,'<script type="application/ld+json">'+JSON.stringify(ld)+'</script>')+`<h1 style="font-size:22px;margin:14px 0 0">${n} <span style="color:var(--mut)">${ar}</span></h1>`+L.map(i=>card(i,'../')).join('\n')+foot('../'));
}
let html=fs.readFileSync('index.html','utf8');
const list=out.slice(0,80).map(i=>card(i,'')).join('\n');
const ld2={"@context":"https://schema.org","@graph":[{"@type":"WebSite","name":"World Live News","url":SITE},{"@type":"ItemList","itemListElement":out.slice(0,30).map((i,n)=>({"@type":"ListItem","position":n+1,"url":arts[i.id]?SITE+'a/'+i.id+'.html':i.u,"name":arts[i.id]?arts[i.id].h:i.t}))}]};
html=html.replace(/<!--LIST-->[\s\S]*?<!--\/LIST-->/,()=>'<!--LIST-->'+list+'<!--/LIST-->').replace(/<!--LD-->[\s\S]*?<!--\/LD-->/,()=>'<!--LD--><script type="application/ld+json">'+JSON.stringify(ld2).replace(/</g,'\\u003c')+'</script><!--/LD-->').replace(/<!--NAV-->[\s\S]*?<!--\/NAV-->/,()=>'<!--NAV-->'+nav('')+'<!--/NAV-->');
fs.writeFileSync('index.html',html);
const urls=[SITE,...Object.keys(SECTIONS).map(k=>SITE+`c/${k}.html`),...ids.slice(0,1500).map(id=>SITE+`a/${id}.html`)];
fs.writeFileSync('sitemap.xml',`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((u,n)=>`<url><loc>${u}</loc>${n<12?`<lastmod>${new Date().toISOString()}</lastmod>`:''}</url>`).join('')}</urlset>`);
fs.writeFileSync('robots.txt',`User-agent: *\nAllow: /\nDisallow: /admin.html\nSitemap: ${SITE}sitemap.xml\n`);
fs.writeFileSync('feed.xml',`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>World Live News</title><link>${SITE}</link><description>Latest world headlines and briefs</description>${out.slice(0,40).map(i=>{const a=arts[i.id];return `<item><title>${E(a?a.h:i.t)}</title><link>${a?SITE+'a/'+i.id+'.html':E(i.u)}</link><description>${E(a?a.p[0]:i.s)}</description><pubDate>${new Date(i.d).toUTCString()}</pubDate></item>`}).join('')}</channel></rss>`);
