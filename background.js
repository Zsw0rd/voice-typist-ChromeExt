
async function getCounts(){
  return new Promise(r=>chrome.storage.local.get(['va_counts_v1'],v=>r(v['va_counts_v1']||{day:{date:new Date().toISOString().slice(0,10),count:0},month:{ym:new Date().toISOString().slice(0,7),count:0},total:0})));
}
async function setCounts(c){
  return new Promise(r=>chrome.storage.local.set({va_counts_v1:c},r));
}
async function bumpCounts(n){
  const now = new Date();
  const d = now.toISOString().slice(0,10);
  const ym = now.toISOString().slice(0,7);
  const c = await getCounts();
  if(c.day.date!==d) c.day={date:d,count:0};
  if(c.month.ym!==ym) c.month={ym,count:0};
  c.day.count += n; c.month.count += n; c.total += n;
  await setCounts(c);
  return c;
}
async function fetchSettings(){
  return new Promise(r=>chrome.storage.local.get(['va_settings_v1'],v=>r(v['va_settings_v1']||{})));
}
chrome.runtime.onMessage.addListener((msg, sender, sendResponse)=>{
  (async()=>{
    if(msg.type==='va_generate'){
      try{
        const s = await fetchSettings();
        const key = s.apiKey||'';
        if(!key) return sendResponse({ok:false,error:'NO_KEY'});
        const model = s.geminiModel || 'gemini-2.0-flash';
        const body = { contents: [{ role:'user', parts:[{text: msg.prompt}]}] };
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,{
          method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)
        });
        if(!res.ok){
          const t = await res.text();
          return sendResponse({ok:false,error:'API_ERROR',detail:t});
        }
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('\n')||'';
        const n = text ? text.split(/\s+/).filter(Boolean).length : 0;
        await bumpCounts(n);
        return sendResponse({ok:true,text});
      }catch(e){
        return sendResponse({ok:false,error:'EXCEPTION'});
      }
    }
    if(msg.type==='va_bump'){
      const n = typeof msg.n==='number'?msg.n:0; const c = await bumpCounts(n); return sendResponse({ok:true,counts:c});
    }
    if(msg.type==='va_get_counts'){ const c=await getCounts(); return sendResponse({ok:true,counts:c}); }
  })();
  return true;
});