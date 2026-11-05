const {cleanTag,requestOfficial,getCached,putCached} = require('../lib/supercell');
module.exports = async function handler(req,res) {
  res.setHeader('Cache-Control','private, no-store');
  if (req.method !== 'GET') return res.status(405).json({error:'GET required.'});
  try {
    const tag = cleanTag(req.query.tag);
    const cached=getCached(`dashboard:${tag}`);
    if(cached) return res.status(200).json(cached);
    const encoded=encodeURIComponent(`#${tag}`);
    const player=await requestOfficial(`/players/${encoded}`);
    let battles=[],battleError=null;
    try { const log=await requestOfficial(`/players/${encoded}/battlelog`); battles=log.items||[]; }
    catch(e) {battleError=e.message;}
    const data={player,battles,updatedAt:new Date().toISOString(),battleError};
    putCached(`dashboard:${tag}`,data,45_000);
    return res.status(200).json(data);
  } catch(e) {return res.status(e.status||500).json({error:e.message||'Unexpected server error.'});}
};
