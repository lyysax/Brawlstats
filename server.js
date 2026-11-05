require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs/promises');
const app = express();
const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const DATA = path.join(ROOT, 'data');
const BRAWL_API = 'https://api.brawlstars.com/v1';
const ASSETS_API = 'https://api.brawlapi.com/v1';
const TAG_PATTERN = /^[0289PYLQGRJCUV]{3,15}$/;
const cache = new Map();

app.disable('x-powered-by');
app.use(express.json({limit:'15kb'}));
app.use(express.static(path.join(ROOT, 'public')));

function tagFrom(raw) {
  const cleaned = String(raw || '').trim().replace(/^#/, '').toUpperCase();
  if (!TAG_PATTERN.test(cleaned)) {
    const error = new Error('Invalid player tag. Check the tag shown in your Brawl Stars profile.');
    error.status = 400;
    throw error;
  }
  return cleaned;
}
function fail(res, error) {
  const status = error.status || 500;
  res.status(status).json({error: error.message || 'Something went wrong.'});
}
async function requestJSON(url, headers = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, {headers, signal: controller.signal});
    if (!response.ok) {
      const error = new Error(response.status === 403 ? 'API access denied. Check your API key and the public IP registered in the Supercell developer portal.' : response.status === 404 ? 'Player not found. Check your tag.' : response.status === 429 ? 'API rate limit reached. Try again shortly.' : `Remote API error (${response.status}).`);
      error.status = response.status;
      throw error;
    }
    return await response.json();
  } catch (error) {
    if (error.name === 'AbortError') { error.status = 504; error.message = 'API request timed out. Please retry.'; }
    throw error;
  } finally { clearTimeout(timer); }
}
async function official(endpoint) {
  if (!process.env.BRAWL_API_KEY || process.env.BRAWL_API_KEY === 'YOUR_SUPERCELL_DEVELOPER_TOKEN') {
    const error = new Error('Missing BRAWL_API_KEY. Add your Supercell API key to the .env file.');
    error.status = 503;
    throw error;
  }
  return requestJSON(`${BRAWL_API}${endpoint}`, {Authorization:`Bearer ${process.env.BRAWL_API_KEY}`});
}
async function asset(name) {
  const cached = cache.get(name);
  if (cached && Date.now() - cached.time < 6 * 60 * 60 * 1000) return cached.data;
  const data = await requestJSON(`${ASSETS_API}/${name}`);
  cache.set(name,{data,time:Date.now()});
  return data;
}
function fileFor(tag) { return path.join(DATA,`${tag}.json`); }
async function readHistory(tag) {
  try {
    const obj = JSON.parse(await fs.readFile(fileFor(tag),'utf8'));
    return {battles: Array.isArray(obj.battles)?obj.battles:[], snapshots: Array.isArray(obj.snapshots)?obj.snapshots:[]};
  } catch(error) {
    if(error.code === 'ENOENT') return {battles:[],snapshots:[]};
    throw error;
  }
}
function battleKey(item) {
  const b = item.battle || {};
  // Battle logs have no unique server-provided battle ID; this deduplicates repeated polls.
  const participants = [...(b.players||[]),...(b.teams||[]).flat()].map(p=>p.tag||p.name||'').sort().join('|');
  return `${item.battleTime||''}:${item.event?.id||''}:${b.mode||''}:${b.type||''}:${participants}`;
}
async function storeHistory(tag, player, items) {
  await fs.mkdir(DATA,{recursive:true});
  const history = await readHistory(tag);
  const known = new Set(history.battles.map(battleKey));
  for (const item of items) {
    if(!item || !item.battleTime) continue;
    const key = battleKey(item);
    if(!known.has(key)) { history.battles.push(item); known.add(key); }
  }
  history.battles.sort((a,b)=>(b.battleTime||'').localeCompare(a.battleTime||''));
  history.battles = history.battles.slice(0,1500);
  const latest = history.snapshots.at(-1);
  const now = new Date().toISOString();
  // One snapshot every 30 minutes, unless trophy total changed.
  if (!latest || Date.now()-new Date(latest.at).getTime()>30*60*1000 || latest.trophies!==player.trophies) {
    history.snapshots.push({at:now,trophies:player.trophies,highestTrophies:player.highestTrophies});
    history.snapshots = history.snapshots.slice(-1500);
  }
  await fs.writeFile(fileFor(tag),JSON.stringify(history,null,2));
  return history;
}
// Serialize writes per tag to avoid overlapping refreshes corrupting local files.
const queues = new Map();
function serialized(tag, action) {
  const previous = queues.get(tag) || Promise.resolve();
  const next = previous.catch(()=>{}).then(action);
  queues.set(tag,next);
  next.finally(()=>{if(queues.get(tag)===next)queues.delete(tag);}).catch(()=>{});
  return next;
}
app.get('/api/dashboard/:tag', async(req,res)=>{
  try {
    const tag = tagFrom(req.params.tag);
    const player = await official(`/players/${encodeURIComponent('#'+tag)}`);
    let battleError = null;
    let items=[];
    try {
      const log = await official(`/players/${encodeURIComponent('#'+tag)}/battlelog`);
      items = log.items || [];
    } catch(error) { battleError = error.message; }
    const history = await serialized(tag,()=>storeHistory(tag,player,items));
    res.json({player,battles:history.battles,snapshots:history.snapshots,liveBattles:items.length,updatedAt:new Date().toISOString(),battleError});
  } catch(error) {fail(res,error);}
});
app.get('/api/assets',async(req,res)=>{
  try {
    const [brawlers,icons,modes] = await Promise.all([asset('brawlers'),asset('icons'),asset('gamemodes')]);
    res.set('Cache-Control','public, max-age=3600');
    res.json({brawlers:brawlers.list||[],icons:icons.player||{},modes:modes.list||[]});
  } catch(error) {fail(res,error);}
});
app.get('/api/health',(req,res)=>res.json({ok:true,hasKey:!!process.env.BRAWL_API_KEY}));
app.get('*',(req,res)=>res.sendFile(path.join(ROOT,'public','index.html')));
app.listen(PORT,'127.0.0.1',()=>console.log(`\n⭐ BrawlStats V2 running at http://localhost:${PORT}\n`));
