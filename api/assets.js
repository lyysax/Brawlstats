const {getJSON,getCached,putCached} = require('../lib/supercell');
module.exports=async function handler(req,res) {
  if(req.method!=='GET')return res.status(405).json({error:'GET required.'});
  const cached=getCached('assets');
  if(cached){res.setHeader('Cache-Control','public, s-maxage=3600');return res.status(200).json(cached);}
  try {
    const base='https://api.brawlapi.com/v1';
    const [brawlers,icons,modes]=await Promise.all([
      getJSON(`${base}/brawlers`),getJSON(`${base}/icons`),getJSON(`${base}/gamemodes`)
    ]);
    const result={brawlers:brawlers.list||[],icons:icons.player||{},modes:modes.list||[]};
    putCached('assets',result,3600_000);
    res.setHeader('Cache-Control','public, s-maxage=3600');
    return res.status(200).json(result);
  }catch(e){return res.status(e.status||502).json({error:e.message});}
};
