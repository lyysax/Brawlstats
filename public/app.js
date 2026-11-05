'use strict';
const $ = id => document.getElementById(id);
const number = value => Number.isFinite(Number(value)) ? Number(value).toLocaleString('en-US') : '—';
const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state = { tag:null, player:null, battles:[], snapshots:[], assets:{brawlers:[],icons:{},modes:[]}, page:'overview', lastUpdated:null, visibleBattles:50, loading:false };
const fmtDate = value => {try {const d= parseBattleDate(value); return d ? d.toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}) : 'Date unavailable';}catch{return 'Date unavailable';}};
function parseBattleDate(value){if(!value)return null;const m=String(value).match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(?:\.\d+)?Z$/);const d=m?new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`):new Date(value);return isNaN(d.getTime())?null:d;}
function img(url, cls='', alt='') {if(typeof url!=='string'||!/^https:\/\/cdn(?:-misc)?\.brawlify\.com\//.test(url))return '';return `<img class="${cls}" src="${safe(url)}" alt="${safe(alt)}" loading="lazy" onerror="this.hidden=true">`;}
function normalize(tag){const cleaned=String(tag||'').trim().replace(/^#/,'').toUpperCase(); if(!/^[0289PYLQGRJCUV]{3,15}$/.test(cleaned)) throw Error('That player tag does not look right. Check your in-game profile.');return cleaned;}
function setMessage(message=''){$('site-notice').hidden=!message;$('site-notice').textContent=message;}
function errorSearch(message){$('search-error').textContent=message||'';}
function goPage(){const page=location.hash.slice(1).toLowerCase();state.page=['overview','brawlers','battles','insights'].includes(page)?page:'overview';document.querySelectorAll('.page').forEach(el=>el.classList.toggle('active',el.id===`page-${state.page}`));document.querySelectorAll('.tab').forEach(el=>{const active=el.dataset.page===state.page;el.classList.toggle('active',active);if(active)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});if(state.player)document.title=`${state.page[0].toUpperCase()+state.page.slice(1)} • BrawlStats`;window.scrollTo({top:0,behavior:'instant'});}
window.addEventListener('hashchange',goPage);
function showSearch(){ $('search-screen').hidden=false;$('site-content').hidden=true; $('tag-input').value=state.tag||'';errorSearch('');$('tag-input').focus();}
function showDashboard(){$('search-screen').hidden=true;$('site-content').hidden=false;goPage();}
function brawlerAsset(id){return state.assets.brawlers.find(b=>Number(b.id)===Number(id));}
function brawlerImage(id){return brawlerAsset(id)?.imageUrl2||brawlerAsset(id)?.imageUrl||'';}
function modeAsset(name){const key=String(name||'').replace(/[\s_-]/g,'').toLowerCase();return state.assets.modes.find(m=>String(m.name||'').replace(/[\s_-]/g,'').toLowerCase()===key);}
function ourBrawler(battle){const teams=battle?.teams||[];const players=[...(battle?.players||[]),...teams.flat()];const me=players.find(p=>p.tag?.toUpperCase()===`#${state.tag}`);return me?.brawler || me?.brawlers?.[0] || (battle?.starPlayer?.tag?.toUpperCase()===`#${state.tag}`?battle.starPlayer.brawler:null) || null;}
function battleMode(item){return item.battle?.mode||item.event?.mode||'Unknown mode';}
function battleOutcome(item){
  const b=item.battle||{};
  const delta=b.trophyChange;
  // Simple rule: gaining trophies = victory, losing trophies = defeat.
  // When no trophy change is available, fall back to the explicit API result.
  if(typeof delta==='number' && delta>0)return {type:'victory',label:'VICTORY',color:'#159d58'};
  if(typeof delta==='number' && delta<0)return {type:'defeat',label:'DEFEAT',color:'#e64255'};
  if(b.result==='victory')return {type:'victory',label:'VICTORY',color:'#159d58'};
  if(b.result==='defeat')return {type:'defeat',label:'DEFEAT',color:'#e64255'};
  if(b.result==='draw')return {type:'unknown',label:'DRAW',color:'#7383ac'};
  return {type:'unknown',label:typeof delta==='number'?'NO CHANGE':'UNKNOWN',color:'#ba8315'};
}
function enriched(){return state.battles.map(item=>({...item,_mode:battleMode(item),_outcome:battleOutcome(item),_brawler:ourBrawler(item.battle)}));}
function frequencies(list,fn){const map=new Map();list.forEach(i=>{const key=fn(i);if(key)map.set(key,(map.get(key)||0)+1);});return [...map.entries()].sort((a,b)=>b[1]-a[1]);}
async function api(path){const r=await fetch(path,{cache:'no-store'});const payload=await r.json().catch(()=>({}));if(!r.ok)throw Error(payload.error||`Request failed (${r.status})`);return payload;}
async function loadAssets(){try{state.assets=await api('/api/assets');}catch(e){console.warn('Optional community images unavailable:',e.message);}}

// Vercel functions do not provide persistent storage. Keep each visitor's history
// locally in their own browser. No Supercell token is ever stored in the browser.
const HISTORY_LIMIT = 300;
function historyKey(tag) { return `brawlstats:history:v3:${tag}`; }
function getStoredHistory(tag) {
  try {
    const h = JSON.parse(localStorage.getItem(historyKey(tag)) || '{}');
    return {battles: Array.isArray(h.battles) ? h.battles : [], snapshots: Array.isArray(h.snapshots) ? h.snapshots : []};
  } catch { return {battles: [], snapshots: []}; }
}
function battleSignature(item) {
  const b = item.battle || {};
  const participants = [...(b.players || []), ...(b.teams || []).flat()]
    .map(p => p.tag || p.name || '').sort().join('|');
  return [item.battleTime || '', item.event?.id || '', b.mode || '', b.type || '', participants].join(':');
}
function saveLocalHistory(tag, player, items) {
  const history = getStoredHistory(tag);
  const known = new Set(history.battles.map(battleSignature));
  for (const item of items) {
    if (!item?.battleTime) continue;
    const key = battleSignature(item);
    if (!known.has(key)) { known.add(key); history.battles.push(item); }
  }
  history.battles.sort((a,b) => (b.battleTime || '').localeCompare(a.battleTime || ''));
  history.battles = history.battles.slice(0, HISTORY_LIMIT);
  const now = new Date().toISOString();
  const last = history.snapshots.at(-1);
  if (!last || last.trophies !== player.trophies || Date.now() - Date.parse(last.at) > 30 * 60 * 1000) {
    history.snapshots.push({at: now, trophies: player.trophies, highestTrophies: player.highestTrophies});
    history.snapshots = history.snapshots.slice(-300);
  }
  // Browsers may restrict storage. If full, remove older battles and try again.
  for (const max of [HISTORY_LIMIT, 150, 75, 25]) {
    try {
      localStorage.setItem(historyKey(tag), JSON.stringify({battles: history.battles.slice(0,max), snapshots: history.snapshots}));
      return {battles: history.battles.slice(0,max), snapshots: history.snapshots};
    } catch { /* storage disabled or full */ }
  }
  return {battles: items, snapshots: history.snapshots};
}

async function loadPlayer(tag, refresh=false){if(state.loading)return;state.loading=true;const button=$('find-button'),refreshBtn=$('refresh-button');button.disabled=true;refreshBtn.disabled=true;button.textContent='LOADING...';refreshBtn.textContent='↻ LOADING...';errorSearch('');setMessage('');try{
  const normalized=normalize(tag);
  const data=await api(`/api/dashboard/${encodeURIComponent(normalized)}`);
  state.tag=normalized;state.player=data.player;const saved=saveLocalHistory(normalized,data.player,data.battles||[]);state.battles=saved.battles;state.snapshots=saved.snapshots;state.lastUpdated=data.updatedAt;
  try { localStorage.setItem('brawlstats:lastTag',normalized); } catch {}
  renderAll();showDashboard();if(data.battleError)setMessage(`Your profile loaded, but the current battle log could not be updated: ${data.battleError}. Previously saved matches in this browser are still shown.`);
  else if(refresh)setMessage('Your stats are up to date! Match history is saved in this browser.');
}catch(e){if(state.player&&refresh)setMessage(e.message);else{showSearch();errorSearch(e.message);}}
finally{state.loading=false;button.disabled=false;refreshBtn.disabled=false;button.textContent="LET'S BRAWL →";refreshBtn.textContent='↻ REFRESH';}}
function renderProfile(){const p=state.player;$('player-name').textContent=p.name||'Player';$('player-tag').textContent=p.tag||`#${state.tag}`;$('player-club').textContent=p.club?.name||'No club';$('updated-label').textContent=`UPDATED ${new Date(state.lastUpdated).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}`;const icon=state.assets.icons[String(p.icon?.id)];const el=$('profile-icon');const url=icon?.imageUrl;if(url&&/^https:\/\/cdn\.brawlify\.com\//.test(url)){el.src=url;el.hidden=false;$('profile-fallback').hidden=true;el.onerror=()=>{el.hidden=true;$('profile-fallback').hidden=false;};}else{el.hidden=true;$('profile-fallback').hidden=false;}}
function renderOverview(){const p=state.player;const brawlers=p.brawlers||[];const wins=[p['3vs3Victories'],p.soloVictories,p.duoVictories];$('stat-trophies').textContent=number(p.trophies);$('stat-highest').textContent=number(p.highestTrophies);$('stat-owned').textContent=number(brawlers.length);$('stat-wins').textContent=wins.some(v=>typeof v==='number')?number(wins.reduce((a,b)=>a+(Number(b)||0),0)):'—';const top=[...brawlers].sort((a,b)=>(b.trophies||0)-(a.trophies||0))[0];$('top-brawler-name').textContent=top?.name||'No Brawlers';$('top-brawler-trophies').textContent=top?`🏆 ${number(top.trophies)} trophies`:'No Brawler information yet';$('top-brawler-art').innerHTML=top?img(brawlerImage(top.id),'','')||'★':'★';const mode=favorites().modes[0];$('favorite-mode-name').textContent=mode?readableMode(mode[0]):'Not enough data';$('favorite-mode-count').textContent=mode?`${number(mode[1])} tracked matches`:'Refresh after playing to track your modes';const art=modeAsset(mode?.[0])?.imageUrl;$('favorite-mode-art').innerHTML=img(art,'','')||'🎯';}
function readableMode(mode){return String(mode||'Unknown').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/^./,x=>x.toUpperCase());}
function favorites(){const records=enriched();return {modes:frequencies(records,x=>x._mode),brawlers:frequencies(records,x=>x._brawler?.name)};}
function renderBrawlers(){const list=state.player?.brawlers||[];const query=$('brawler-search').value.trim().toLowerCase();const sort=$('brawler-sort').value;const filtered=list.filter(b=>b.name?.toLowerCase().includes(query)).sort((a,b)=>sort==='highest'?(b.highestTrophies||0)-(a.highestTrophies||0):sort==='power'?(b.power||0)-(a.power||0):sort==='name'?a.name.localeCompare(b.name):(b.trophies||0)-(a.trophies||0));$('brawler-total-pill').textContent=`${list.length} OWNED`;$('brawler-empty').hidden=filtered.length>0;
$('brawlers-grid').innerHTML=filtered.map(b=>{const color=brawlerAsset(b.id)?.rarity?.color||'#8853d4';return `<button class="brawler-card" data-brawler="${b.id}"><div class="brawler-art" style="--rarity:${safe(/^#[0-9a-f]{6}$/i.test(color)?color:'#8853d4')}"><span class="power-badge">POWER ${number(b.power)}</span>${img(brawlerImage(b.id),'',b.name)||'<span class="brawler-placeholder">★</span>'}</div><div class="brawler-info"><h3>${safe(b.name)}</h3><div class="brawler-trophies">🏆 ${number(b.trophies)}</div><div class="brawler-record">Best: ${number(b.highestTrophies)}</div></div></button>`;}).join('');}
function populateFilters(){const records=enriched();const modeVal=$('battle-mode').value,brawlerVal=$('battle-brawler').value;const modes=[...new Set(records.map(b=>b._mode))].sort();const brawlers=[...new Set(records.map(b=>b._brawler?.name).filter(Boolean))].sort();$('battle-mode').innerHTML='<option value="all">All Modes</option>'+modes.map(m=>`<option value="${safe(m)}">${safe(readableMode(m))}</option>`).join('');$('battle-brawler').innerHTML='<option value="all">All Brawlers</option>'+brawlers.map(m=>`<option value="${safe(m)}">${safe(m)}</option>`).join('');$('battle-mode').value=modes.includes(modeVal)?modeVal:'all';$('battle-brawler').value=brawlers.includes(brawlerVal)?brawlerVal:'all';}
function currentFilteredBattles(){return enriched().filter(b=>{const result=$('battle-result').value,mode=$('battle-mode').value,brawler=$('battle-brawler').value;return (result==='all'||result===b._outcome.type)&&(mode==='all'||mode===b._mode)&&(brawler==='all'||brawler===b._brawler?.name);});}
function renderBattles(){$('battles-total-pill').textContent=`${state.battles.length} TRACKED`;const filtered=currentFilteredBattles();const items=filtered.slice(0,state.visibleBattles);$('battles-show-more').hidden=filtered.length<=items.length;$('battles-show-more').textContent=`SHOW MORE (${number(filtered.length-items.length)} LEFT) ↓`;$('battles-empty').hidden=items.length>0;$('battles-list').innerHTML=items.map((item,index)=>{const result=item._outcome;const b=item.battle||{};const trophy=typeof b.trophyChange==='number'?`${b.trophyChange>0?'+':''}${b.trophyChange} 🏆`:'';const portrait=brawlerImage(item._brawler?.id);return `<button class="battle-row" data-battle="${index}" style="--stripe:${result.color}"><div class="battle-icon">${img(portrait,'',item._brawler?.name||'Brawler')||'⚔️'}</div><div class="battle-main"><h3>${safe(readableMode(item._mode))}</h3><p>${safe(item.event?.map||'Unknown map')} · ${safe(item._brawler?.name||'Brawler unavailable')} · ${safe(fmtDate(item.battleTime))}</p></div><div class="battle-result"><strong>${safe(result.label)}</strong><p>${safe(trophy)}</p></div></button>`;}).join('');}
function chartBars(items, limit=6){if(!items.length)return '<div class="chart-empty">Not enough data yet. Play some matches and refresh! Your extra history is stored in this browser.</div>';const max=Math.max(...items.map(i=>i[1]),1);return `<div class="bar-list">${items.slice(0,limit).map(([name,count])=>`<div><div class="bar-label"><span>${safe(readableMode(name))}</span><span>${number(count)} matches</span></div><div class="bar-track"><div class="bar-fill" style="width:${Math.round(count/max*100)}%"></div></div></div>`).join('')}</div>`;}
function lineChart(snapshots){if(snapshots.length<2)return `<div class="chart-empty">Your trophy chart will appear after at least two profile check-ins.<br>Come back after playing!</div>`;const values=snapshots.map(s=>Number(s.trophies)||0),low=Math.min(...values),high=Math.max(...values),range=Math.max(1,high-low),w=850,h=220,pad=35;const pts=values.map((v,i)=>[pad+i*(w-pad*2)/(values.length-1),h-pad-(v-low)/range*(h-pad*2)]);const path=pts.map((p,i)=>`${i?'L':'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');return `<svg class="chart-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Trophy progression from ${number(values[0])} to ${number(values.at(-1))}"><line x1="${pad}" x2="${w-pad}" y1="${h-pad}" y2="${h-pad}" stroke="#9eafd2" stroke-width="2"/><line x1="${pad}" x2="${w-pad}" y1="${pad}" y2="${pad}" stroke="#e5e8f0" stroke-width="2"/><path d="${path}" fill="none" stroke="#237cea" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>${pts.map(([x,y])=>`<circle cx="${x}" cy="${y}" r="${values.length>45?2:4}" fill="#ffcb25" stroke="#123174" stroke-width="2"/>`).join('')}<text x="${pad}" y="${pad-10}" font-size="16" font-weight="bold" fill="#344b7e">${number(high)}</text><text x="${pad}" y="${h-7}" font-size="16" font-weight="bold" fill="#344b7e">${number(low)}</text></svg><div class="axis-caption">${number(values[0])} → ${number(values.at(-1))} trophies · ${snapshots.length} saved check-ins</div>`;}
function renderInsights(){const records=enriched(),decided=records.filter(i=>['victory','defeat'].includes(i._outcome.type)),wins=decided.filter(i=>i._outcome.type==='victory').length,losses=decided.length-wins,rate=decided.length?Math.round(wins/decided.length*100):null;const {modes,brawlers}=favorites();$('insights-total-pill').textContent=`${records.length} TRACKED`;$('insight-decided').textContent=number(decided.length);$('insight-winrate').textContent=rate===null?'—':`${rate}%`;$('insight-most-mode').textContent=modes[0]?readableMode(modes[0][0]):'—';$('insight-most-mode-sub').textContent=modes[0]?`${number(modes[0][1])} matches played`:'From saved battles';$('insight-most-brawler').textContent=brawlers[0]?.[0]||'—';$('insight-most-brawler-sub').textContent=brawlers[0]?`${number(brawlers[0][1])} matches played`:'From saved battles';$('result-chart').innerHTML=rate===null?'<div class="chart-empty">No wins or losses recorded yet.</div>':`<div class="donut-wrap"><div class="donut" style="--win:${rate}%"><div class="donut-hole">${rate}%</div></div><div class="legend"><div><b class="win"></b>${number(wins)} victories</div><div><b class="lose"></b>${number(losses)} defeats</div><div style="font-size:12px;color:#697792">${records.length-decided.length} other results excluded</div></div></div>`;$('mode-chart').innerHTML=chartBars(modes);$('brawler-chart').innerHTML=chartBars(brawlers,8);$('trophy-chart').innerHTML=lineChart(state.snapshots);}
function renderAll(){renderProfile();renderOverview();renderBrawlers();populateFilters();renderBattles();renderInsights();}
function showDialog(html){$('dialog-content').innerHTML=html;$('detail-dialog').showModal();}
function showBrawler(id){const b=(state.player.brawlers||[]).find(item=>Number(item.id)===Number(id));if(!b)return;const image=brawlerImage(b.id);const records=enriched().filter(r=>r._brawler?.id===b.id);const decided=records.filter(r=>['victory','defeat'].includes(r._outcome.type));const wins=decided.filter(r=>r._outcome.type==='victory').length;const stats=[['Current trophies',number(b.trophies)],['Personal best',number(b.highestTrophies)],['Power level',number(b.power)],['Recorded matches',number(records.length)],['Tracked win rate',decided.length?`${Math.round(wins/decided.length*100)}%`:'Not enough data'],['Gadgets',number(b.gadgets?.length||0)],['Star Powers',number(b.starPowers?.length||0)],['Gears',number(b.gears?.length||0)]];showDialog(`<div class="detail-hero">${img(image,'',b.name)}<div><p class="mini-label">BRAWLER DETAILS</p><h2>${safe(b.name)}</h2><p>${safe(brawlerAsset(b.id)?.rarity?.name||'Brawler')}</p></div></div><div class="detail-grid">${stats.map(([label,value])=>`<div><span>${safe(label)}</span><b>${safe(value)}</b></div>`).join('')}</div><p class="small-footnote" style="color:#5b6888">Tracked win rate uses trophy gains/losses, with game results as fallback.</p>`);}
function showBattle(index){
  const item=currentFilteredBattles().slice(0,state.visibleBattles)[index];
  if(!item)return;
  const battle=item.battle||{}, outcome=item._outcome;
  const delta=Number.isFinite(battle.trophyChange)?battle.trophyChange:null;
  // Trophy gains count as wins and trophy losses count as defeats.
  const tone=outcome.type==='victory'?'win':outcome.type==='defeat'?'loss':
    delta!==null&&delta>0?'win':delta!==null&&delta<0?'loss':'neutral';
  const subtitle=outcome.type==='victory'?'MATCH WON':outcome.type==='defeat'?'MATCH LOST':'MATCH RESULT';
  const deltaLabel=delta===null?'Not available':`${delta>0?'+':''}${delta} trophies`;
  const mode=readableMode(item._mode);
  const brawler=item._brawler;
  const portrait=brawlerImage(brawler?.id);
  const portraitHtml=img(portrait,'battle-v2-portrait',brawler?.name||'Brawler');
  const details=[
    {icon:'🗺️',label:'MAP',value:item.event?.map||'Unknown map',theme:'sky'},
    {icon:'🎮',label:'GAME MODE',value:mode,theme:'purple'},
    {icon:'⭐',label:'BRAWLER',value:brawler?.name||'Unavailable',theme:'pink'},
    {icon:'🏅',label:'PLACEMENT',value:Number.isFinite(battle.rank)?`#${battle.rank}`:'Not available',theme:'gold'},
    {icon:'⚔️',label:'MATCH TYPE',value:battle.type||'Unknown',theme:'mint'},
    {icon:'⏱️',label:'DURATION',value:Number.isFinite(battle.duration)?`${Math.floor(battle.duration/60)}m ${String(battle.duration%60).padStart(2,'0')}s`:'Not provided',theme:'sky'}
  ];
  const cards=details.map(d=>`<div class="battle-v2-card ${d.theme}"><span class="battle-v2-card-icon" aria-hidden="true">${d.icon}</span><div><span class="battle-v2-card-label">${d.label}</span><strong class="battle-v2-card-value">${safe(d.value)}</strong></div></div>`).join('');
  showDialog(`<section class="battle-detail-v2 ${tone}">
    <div class="battle-v2-banner">
      <p class="battle-v2-eyebrow">BATTLE REPORT · ${safe(fmtDate(item.battleTime))}</p>
      <div class="battle-v2-hero">
        <div class="battle-v2-art">${portraitHtml||'<span aria-hidden="true">⭐</span>'}</div>
        <div class="battle-v2-title"><span>${subtitle}</span><h2>${safe(outcome.label)}</h2><p>${safe(brawler?.name||'Brawler unavailable')} · ${safe(mode)}</p></div>
      </div>
      <div class="battle-v2-summary"><span class="battle-v2-trophy">🏆 ${safe(deltaLabel)}</span><span class="battle-v2-date">${safe(item.event?.map||'Unknown map')}</span></div>
    </div>
    <div class="battle-v2-content">
      <h3>Match highlights</h3>
      <div class="battle-v2-cards">${cards}</div>
      
    </div>
  </section>`);
}

function csvDownload(){const rows=[['Date','Mode','Map','Result','Brawler','Rank','Trophy Change']];currentFilteredBattles().forEach(item=>rows.push([item.battleTime||'',item._mode,item.event?.map||'',item._outcome.label,item._brawler?.name||'',item.battle?.rank??'',item.battle?.trophyChange??'']));const csv=rows.map(row=>row.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(',')).join('\r\n');const url=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`brawlstats-${state.tag}-battles.csv`;a.click();URL.revokeObjectURL(url);}
$('battles-show-more').addEventListener('click',()=>{state.visibleBattles+=50;renderBattles();});
$('player-form').addEventListener('submit',e=>{e.preventDefault();loadPlayer($('tag-input').value);});$('open-search').addEventListener('click',showSearch);$('refresh-button').addEventListener('click',()=>state.tag&&loadPlayer(state.tag,true));$('brawler-search').addEventListener('input',renderBrawlers);$('brawler-sort').addEventListener('change',renderBrawlers);['battle-result','battle-mode','battle-brawler'].forEach(id=>$(id).addEventListener('change',renderBattles));$('brawlers-grid').addEventListener('click',e=>{const card=e.target.closest('[data-brawler]');if(card)showBrawler(card.dataset.brawler);});$('battles-list').addEventListener('click',e=>{const row=e.target.closest('[data-battle]');if(row)showBattle(Number(row.dataset.battle));});$('export-battles').addEventListener('click',csvDownload);$('close-dialog').addEventListener('click',()=>$('detail-dialog').close());$('detail-dialog').addEventListener('click',e=>{if(e.target===$('detail-dialog'))$('detail-dialog').close();});
(async()=>{goPage();await loadAssets();let remembered=null;try{remembered=localStorage.getItem('brawlstats:lastTag');}catch{}if(remembered){$('tag-input').value=remembered;await loadPlayer(remembered);}else showSearch();})();

// Poll while the page is open: retain earlier battles before they leave the API's 25-match window.
setInterval(()=>{if(state.tag&&!state.loading&&!document.hidden)loadPlayer(state.tag,true);},5*60*1000);
