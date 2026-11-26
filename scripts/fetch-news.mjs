import fs from 'node:fs';
const FEEDS=[
['BBC News','https://feeds.bbci.co.uk/news/world/rss.xml'],
['Al Jazeera','https://www.aljazeera.com/xml/rss/all.xml'],
['NYT World','https://rss.nytimes.com/services/xml/rss/nyt/World.xml'],
['NPR','https://feeds.npr.org/1004/rss.xml'],
['DW','https://rss.dw.com/rdf/rss-en-world'],
['France 24','https://www.france24.com/en/rss'],
['Sky News','https://feeds.skynews.com/feeds/rss/world.xml'],
['الجزيرة','https://www.aljazeera.net/aljazeerarss/a7c186be-1baa-4bd4-9d80-a84db769f779/73d0e1b4-532f-45ef-b135-bfdb00d3d2b7','ar'],
['BBC عربي','https://feeds.bbci.co.uk/arabic/rss.xml','ar'],
['فرانس 24','https://www.france24.com/ar/rss','ar'],
['DW عربية','https://rss.dw.com/xml/rss-ar-all','ar'],
['سكاي نيوز عربية','https://www.skynewsarabia.com/web/rss','ar'],
];
const dec=s=>s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#0?39;|&apos;/g,"'").replace(/&#8217;/g,"’").replace(/\s+/g,' ').trim();
const tag=(b,t)=>{const m=b.match(new RegExp('<'+t+'[^>]*>([\\s\\S]*?)</'+t+'>','i'));return m?dec(m[1]):''};
const img=b=>{const m=b.match(/<(?:media:content|media:thumbnail|enclosure)[^>]*url="([^"]+)"/i);return m?m[1]:''};
const items=[];const status={};
await Promise.all(FEEDS.map(async([src,url,lang])=>{
 try{const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 NewsAggregator'},signal:AbortSignal.timeout(20000)});
  if(!r.ok)throw new Error(r.status);const x=await r.text();
  const blocks=x.match(/<item[\s>][\s\S]*?<\/item>/gi)||[];let n=0;
  for(const b of blocks.slice(0,25)){
   let link=tag(b,'link');const title=tag(b,'title');if(!title||!link)continue;
   const d=Date.parse(tag(b,'pubDate')||tag(b,'dc:date')||'')||Date.now();
   let sum=tag(b,'description');if(sum.length>300)sum=sum.slice(0,297).replace(/\s\S*$/,'')+'...';
   items.push({t:title,s:sum,u:link,src,d,i:img(b),l:lang||'en'});n++;}
  status[src]=n;}catch(e){status[src]='error '+e.message;}
}));
const seen=new Set();const out=items.sort((a,b)=>b.d-a.d).filter(i=>{const k=i.t.toLowerCase().slice(0,60);if(seen.has(k))return false;seen.add(k);return i.d<=Date.now()+3600e3}).slice(0,220);
fs.writeFileSync('news.json',JSON.stringify({updated:Date.now(),status,items:out}));
console.log(status,out.length);

const SITE='https://apdalrhmanalpop.github.io/news/';
const E=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
let html=fs.readFileSync('index.html','utf8');
const list=out.slice(0,80).map(i=>`<a class="card" dir="auto" data-l="${i.l}" href="${E(i.u)}" target="_blank" rel="noopener">${i.i?`<img loading="lazy" src="${E(i.i)}" alt="">`:''}<div><h3>${E(i.t)}</h3><p>${E(i.s)}</p><div class="meta"><b>${E(i.src)}</b> · <time datetime="${new Date(i.d).toISOString()}">${new Date(i.d).toUTCString().slice(5,22)} UTC</time></div></div></a>`).join('\n');
const ld={"@context":"https://schema.org","@graph":[{"@type":"WebSite","name":"World Live News","url":SITE},{"@type":"ItemList","itemListElement":out.slice(0,30).map((i,n)=>({"@type":"ListItem","position":n+1,"url":i.u,"name":i.t}))}]};
html=html.replace(/<!--LIST-->[\s\S]*?<!--\/LIST-->/,'<!--LIST-->'+list+'<!--/LIST-->').replace(/<!--LD-->[\s\S]*?<!--\/LD-->/,'<!--LD--><script type="application/ld+json">'+JSON.stringify(ld).replace(/</g,'\\u003c')+'</script><!--/LD-->');
fs.writeFileSync('index.html',html);
fs.writeFileSync('sitemap.xml',`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${SITE}</loc><lastmod>${new Date().toISOString()}</lastmod><changefreq>always</changefreq></url></urlset>`);
fs.writeFileSync('robots.txt',`User-agent: *\nAllow: /\nDisallow: /admin.html\nSitemap: ${SITE}sitemap.xml\n`);
fs.writeFileSync('feed.xml',`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>World Live News</title><link>${SITE}</link><description>Latest world headlines</description>${out.slice(0,40).map(i=>`<item><title>${E(i.t)}</title><link>${E(i.u)}</link><description>${E(i.s)}</description><pubDate>${new Date(i.d).toUTCString()}</pubDate><source url="${E(i.u)}">${E(i.src)}</source></item>`).join('')}</channel></rss>`);
