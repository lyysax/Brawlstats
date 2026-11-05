// Shared fetch functions for Vercel and local development.
const TAG_RE = /^[0289PYLQGRJCUV]{3,15}$/;
const API_BASE = 'https://bsproxy.royaleapi.dev/v1';
const cache = new Map();
function fail(status, message) { const error = new Error(message); error.status = status; return error; }
function cleanTag(raw) {
  const tag = String(raw || '').replace(/^#/, '').trim().toUpperCase();
  if (!TAG_RE.test(tag)) throw fail(400, 'Invalid Brawl Stars player tag.');
  return tag;
}
async function getJSON(url, headers={}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch(url, {headers,signal:controller.signal});
    if (!response.ok) {
      const message = response.status===403 ? 'Supercell access denied. Check the RoyaleAPI proxy IP on your developer key.'
        : response.status===404 ? 'Player not found. Check the tag.'
        : response.status===429 ? 'Too many requests. Please retry shortly.'
        : `Brawl Stars API unavailable (${response.status}).`;
      throw fail([400,403,404,429].includes(response.status)?response.status:502,message);
    }
    return await response.json();
  } catch (error) {
    if (error.name === 'AbortError') throw fail(504, 'The game API took too long to respond. Try again.');
    if (error.status) throw error;
    throw fail(502, 'Could not reach the game API or community proxy. Try again later.');
  } finally { clearTimeout(timer); }
}
async function requestOfficial(endpoint) {
  const key = process.env.BRAWL_API_KEY;
  if (!key || key==='YOUR_SUPERCELL_KEY') throw fail(503,'Server API key not configured.');
  // This third-party proxy forwards the developer token to Supercell. Do not use
  // this service if you are unwilling to trust the community-operated proxy.
  return getJSON(`${API_BASE}${endpoint}`, {Authorization:`Bearer ${key}`});
}
function getCached(key) { const value=cache.get(key); return value && value.until>Date.now() ? value.data : null; }
function putCached(key,data,ttl) { if(cache.size>100)cache.clear();cache.set(key,{data,until:Date.now()+ttl}); }
module.exports={cleanTag,requestOfficial,getJSON,getCached,putCached,fail};
