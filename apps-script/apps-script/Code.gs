// Bound to a Google Sheet. Script property OWNER_KEY holds the owner secret.
function sheet_(n,h){var ss=SpreadsheetApp.getActive();var s=ss.getSheetByName(n);if(!s){s=ss.insertSheet(n);s.appendRow(h);}return s;}
function json_(o){return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);}
function owner_(k){return k&&k===PropertiesService.getScriptProperties().getProperty('OWNER_KEY');}
function getCfg_(){var p=PropertiesService.getScriptProperties().getProperty('CFG');return p?JSON.parse(p):{adsEnabled:true,adsFrom:'00:00',adsTo:'23:59',tz:'Africa/Cairo',breaking:''};}
function doGet(e){
  var p=e.parameter,a=p.action;
  if(a==='hit'){var s=sheet_('hits',['ts','vid','page','ref']);s.appendRow([Date.now(),String(p.vid||'').slice(0,40),String(p.page||'').slice(0,100),String(p.ref||'').slice(0,100)]);return json_({ok:1});}
  if(a==='config'){var c=getCfg_();return json_({adsEnabled:c.adsEnabled,adsFrom:c.adsFrom,adsTo:c.adsTo,tz:c.tz,breaking:c.breaking});}
  if(!owner_(p.key))return json_({error:'unauthorized'});
  if(a==='stats'){
    var from=+p.from,to=+p.to,buckets=Math.min(+p.buckets||24,200),step=(to-from)/buckets;
    var d=sheet_('hits',['ts','vid','page','ref']).getDataRange().getValues();d.shift();
    var series=[],uq=[];for(var i=0;i<buckets;i++){series.push(0);uq.push({});}
    var total=0,all={};
    d.forEach(function(r){var t=+r[0];if(t>=from&&t<=to){var b=Math.min(buckets-1,Math.floor((t-from)/step));series[b]++;uq[b][r[1]]=1;total++;all[r[1]]=1;}});
    var live=0,lv={};d.forEach(function(r){if(Date.now()-r[0]<120000)lv[r[1]]=1;});live=Object.keys(lv).length;
    var e2=sheet_('earnings',['ts','amount','note']).getDataRange().getValues();e2.shift();
    var earn=0,rows=[];e2.forEach(function(r){var t=+r[0];if(t>=from&&t<=to){earn+=+r[1];rows.push({ts:t,amount:+r[1],note:r[2]});}});
    return json_({total:total,unique:Object.keys(all).length,live:live,series:series,uniqueSeries:uq.map(function(o){return Object.keys(o).length}),earnings:earn,earningRows:rows,from:from,to:to});
  }
  if(a==='setconfig'){var c=getCfg_();['adsEnabled','adsFrom','adsTo','tz','breaking'].forEach(function(k){if(p[k]!==undefined)c[k]=(k==='adsEnabled')?p[k]==='true':p[k];});PropertiesService.getScriptProperties().setProperty('CFG',JSON.stringify(c));return json_({ok:1,cfg:c});}
  if(a==='addearning'){sheet_('earnings',['ts','amount','note']).appendRow([+p.ts||Date.now(),+p.amount,String(p.note||'')]);return json_({ok:1});}
  return json_({error:'unknown'});
}
